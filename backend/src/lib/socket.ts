import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { parse as parseCookie } from "cookie";
import { createAdapter } from "@socket.io/redis-adapter";
import { corsOrigins } from "./env.js";
import { createAdapterClients, redisEnabled } from "./redis.js";
import { logger } from "./logger.js";
import { socketConnectionsActive } from "./metrics.js";
import Message, { type IMessage } from "../models/message.model.js";
import Conversation, { getOrCreateDirect, type IConversation } from "../models/conversation.model.js";
import User from "../models/user.model.js";

interface ServerToClientEvents {
  newMessage: (message: IMessage) => void;
  getOnlineUsers: (userIds: string[]) => void;
  typing: (payload: { from: string; isTyping: boolean }) => void;
  recording: (payload: { from: string; isRecording: boolean }) => void;
  messagesRead: (payload: { by: string; conversationId: string; readAt: string }) => void;
  messagesDelivered: (payload: { by: string; conversationId: string }) => void;
  groupMessagesRead: (payload: { conversationId: string; userId: string }) => void;
  messageUpdated: (message: IMessage) => void;
  messageViewed: (payload: { messageId: string; by: string }) => void;
  conversationCreated: (conversation: IConversation) => void;
  conversationUpdated: (conversation: IConversation) => void;
  "call:incoming": (p: { from: string; fromName?: string; fromPic?: string; offer: unknown; video: boolean }) => void;
  "call:answered": (p: { from: string; answer: unknown }) => void;
  "call:ice": (p: { from: string; candidate: unknown }) => void;
  "call:end": (p: { from: string }) => void;
  "call:reject": (p: { from: string }) => void;
}

interface ClientToServerEvents {
  typing: (payload: { to: string; isTyping: boolean }) => void;
  recording: (payload: { to: string; isRecording: boolean }) => void;
  markRead: (payload: { to: string }) => void;
  markDelivered: (payload: { to: string }) => void;
  "call:offer": (p: { to: string; offer: unknown; video: boolean; fromName?: string; fromPic?: string }) => void;
  "call:answer": (p: { to: string; answer: unknown }) => void;
  "call:ice": (p: { to: string; candidate: unknown }) => void;
  "call:end": (p: { to: string }) => void;
  "call:reject": (p: { to: string }) => void;
}

const app = express();
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

// With Redis, room state is shared across instances so we can scale horizontally.
const adapterClients = createAdapterClients();
if (adapterClients) {
  io.adapter(createAdapter(adapterClients.pubClient, adapterClients.subClient));
  logger.info("Socket.IO Redis adapter enabled (multi-node)");
}

const userRoom = (userId: string) => `user:${userId}`;

export async function getOnlineUserIds(): Promise<string[]> {
  const adapter = io.of("/").adapter as unknown as {
    allRooms?: () => Promise<Set<string>>; // Redis adapter only — cluster-wide
    rooms?: Map<string, Set<string>>; // in-memory adapter — local node
  };

  const rooms =
    typeof adapter.allRooms === "function"
      ? await adapter.allRooms()
      : new Set<string>(adapter.rooms ? adapter.rooms.keys() : []);
  return [...rooms].filter((r) => r.startsWith("user:")).map((r) => r.slice(5));
}

io.use((socket, next) => {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie || "");
    const token = cookies.jwt;
    if (!token) return next(new Error("Unauthorized - No Token Provided"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
    };
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error("Unauthorized - Invalid Token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.userId!;
  socket.join(userRoom(userId));
  socketConnectionsActive.inc();

  io.emit("getOnlineUsers", await getOnlineUserIds());

  // relay typing state to the other participant (cross-node via the adapter)
  socket.on("typing", ({ to, isTyping }) => {
    if (typeof to !== "string") return;
    io.to(userRoom(to)).emit("typing", { from: userId, isTyping: Boolean(isTyping) });
  });

  // relay voice-note recording state to the other participant
  socket.on("recording", ({ to, isRecording }) => {
    if (typeof to !== "string") return;
    io.to(userRoom(to)).emit("recording", { from: userId, isRecording: Boolean(isRecording) });
  });

  // receiver opened/viewed the chat → stamp readAt (+ delivered) and tell the sender
  socket.on("markRead", async ({ to }) => {
    if (typeof to !== "string") return;
    const me = await User.findById(userId).select("privacy ghostMode").lean();
    const conv = await getOrCreateDirect(userId, to);
    const now = new Date();

    // read receipts disabled (or ghost mode): clear unread + mark delivered, never reveal "seen"
    if (me?.privacy?.readReceipts === false || me?.ghostMode) {
      await Message.updateMany(
        { conversationId: conv._id, receiverId: userId, deliveredAt: { $exists: false } },
        { $set: { deliveredAt: now } }
      );
      await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${userId}`]: 0 } });
      io.to(userRoom(to)).emit("messagesDelivered", { by: userId, conversationId: String(conv._id) });
      return;
    }

    const result = await Message.updateMany(
      { conversationId: conv._id, receiverId: userId, readAt: { $exists: false } },
      { $set: { readAt: now, deliveredAt: now } }
    );
    if (result.modifiedCount === 0) return; // nothing new to acknowledge
    await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${userId}`]: 0 } });
    io.to(userRoom(to)).emit("messagesRead", {
      by: userId,
      conversationId: String(conv._id),
      readAt: now.toISOString(),
    });
  });

  // receiver's device got the message(s) but hasn't opened the chat yet
  socket.on("markDelivered", async ({ to }) => {
    if (typeof to !== "string") return;
    const conv = await getOrCreateDirect(userId, to);
    const result = await Message.updateMany(
      { conversationId: conv._id, receiverId: userId, deliveredAt: { $exists: false } },
      { $set: { deliveredAt: new Date() } }
    );
    if (result.modifiedCount === 0) return;
    io.to(userRoom(to)).emit("messagesDelivered", { by: userId, conversationId: String(conv._id) });
  });

  // ---- WebRTC call signaling (relay only) ----
  socket.on("call:offer", ({ to, offer, video, fromName, fromPic }) => {
    if (typeof to !== "string") return;
    io.to(userRoom(to)).emit("call:incoming", { from: userId, fromName, fromPic, offer, video });
  });
  socket.on("call:answer", ({ to, answer }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("call:answered", { from: userId, answer });
  });
  socket.on("call:ice", ({ to, candidate }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("call:ice", { from: userId, candidate });
  });
  socket.on("call:end", ({ to }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("call:end", { from: userId });
  });
  socket.on("call:reject", ({ to }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("call:reject", { from: userId });
  });

  socket.on("disconnect", async () => {
    socketConnectionsActive.dec();
    const online = await getOnlineUserIds();
    // if this was the user's last device, stamp their last-seen time
    if (!online.includes(userId)) {
      await User.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } }).catch(() => {});
    }
    io.emit("getOnlineUsers", online);
  });
});

export { io, app, server, userRoom, redisEnabled };
