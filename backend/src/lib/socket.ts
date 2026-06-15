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
import Conversation, { getOrCreateDirect } from "../models/conversation.model.js";
import User from "../models/user.model.js";

interface ServerToClientEvents {
  newMessage: (message: IMessage) => void;
  getOnlineUsers: (userIds: string[]) => void;
  typing: (payload: { from: string; isTyping: boolean }) => void;
  messagesRead: (payload: { by: string; conversationId: string; readAt: string }) => void;
  messageUpdated: (message: IMessage) => void;
}

interface ClientToServerEvents {
  typing: (payload: { to: string; isTyping: boolean }) => void;
  markRead: (payload: { to: string }) => void;
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
    allRooms(): Promise<Set<string>>;
  };
  const rooms = await adapter.allRooms();
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

  // receiver opened/viewed the chat → stamp readAt and tell the sender
  socket.on("markRead", async ({ to }) => {
    if (typeof to !== "string") return;
    const conv = await getOrCreateDirect(userId, to);
    const readAt = new Date();
    const result = await Message.updateMany(
      { conversationId: conv._id, receiverId: userId, readAt: { $exists: false } },
      { $set: { readAt } }
    );
    if (result.modifiedCount === 0) return; // nothing new to acknowledge
    await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${userId}`]: 0 } });
    io.to(userRoom(to)).emit("messagesRead", {
      by: userId,
      conversationId: String(conv._id),
      readAt: readAt.toISOString(),
    });
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
