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
  "call:renegotiate": (p: { from: string; offer: unknown }) => void; // mid-call track change (screen share / voice→video)
  "call:renegotiate-answer": (p: { from: string; answer: unknown }) => void;
  // group / multi-person calls (mesh)
  "gcall:incoming": (p: { roomId: string; from: string; fromName?: string; fromPic?: string; video: boolean; title?: string; groupId?: string }) => void;
  "gcall:peers": (p: { roomId: string; peers: { userId: string; name?: string; pic?: string }[] }) => void;
  "gcall:peer-joined": (p: { roomId: string; userId: string; name?: string; pic?: string }) => void;
  "gcall:offer": (p: { roomId: string; from: string; offer: unknown }) => void;
  "gcall:answer": (p: { roomId: string; from: string; answer: unknown }) => void;
  "gcall:ice": (p: { roomId: string; from: string; candidate: unknown }) => void;
  "gcall:peer-left": (p: { roomId: string; userId: string }) => void;
  "gcall:state": (p: { roomId: string; groupId?: string; active: boolean; count: number }) => void;
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
  "call:renegotiate": (p: { to: string; offer: unknown }) => void;
  "call:renegotiate-answer": (p: { to: string; answer: unknown }) => void;
  // group / multi-person calls (mesh)
  "gcall:invite": (p: { roomId: string; groupId?: string; to: string[]; video: boolean; title?: string; fromName?: string; fromPic?: string }) => void;
  "gcall:join": (p: { roomId: string; groupId?: string; name?: string; pic?: string }) => void;
  "gcall:offer": (p: { roomId: string; to: string; offer: unknown }) => void;
  "gcall:answer": (p: { roomId: string; to: string; answer: unknown }) => void;
  "gcall:ice": (p: { roomId: string; to: string; candidate: unknown }) => void;
  "gcall:leave": (p: { roomId: string }) => void;
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

// group-call room state (in-memory; single-node)
// roomId -> (userId -> { name, pic }); roomMeta tracks the group + who to notify
// so members can join a group call after it has already started.
type RoomMember = { name?: string; pic?: string };
const callRooms = new Map<string, Map<string, RoomMember>>();
const roomMeta = new Map<string, { groupId?: string; notify: Set<string> }>();

function broadcastCallState(roomId: string, active: boolean) {
  const meta = roomMeta.get(roomId);
  if (!meta?.groupId) return; // only group calls advertise an "ongoing" state
  const count = callRooms.get(roomId)?.size ?? 0;
  for (const uid of meta.notify) {
    io.to(userRoom(uid)).emit("gcall:state", { roomId, groupId: meta.groupId, active, count });
  }
}

function leaveCallRoom(roomId: string, uid: string) {
  const members = callRooms.get(roomId);
  if (!members || !members.has(uid)) return;
  members.delete(uid);
  for (const other of members.keys()) io.to(userRoom(other)).emit("gcall:peer-left", { roomId, userId: uid });
  if (members.size === 0) {
    callRooms.delete(roomId);
    broadcastCallState(roomId, false);
    roomMeta.delete(roomId);
  } else {
    broadcastCallState(roomId, true);
  }
}

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

// users in Ghost Mode: appear offline, don't broadcast typing, and can't be called.
const ghostUsers = new Set<string>();
export const isGhost = (userId: string) => ghostUsers.has(userId);

// online ids minus ghost users — what we actually advertise to clients
async function visibleOnlineIds(): Promise<string[]> {
  return (await getOnlineUserIds()).filter((id) => !ghostUsers.has(id));
}
async function broadcastOnline() {
  io.emit("getOnlineUsers", await visibleOnlineIds());
}

// called by the privacy controller when a user toggles Ghost Mode
export async function setGhostPresence(userId: string, on: boolean) {
  if (on) ghostUsers.add(userId);
  else ghostUsers.delete(userId);
  await broadcastOnline();
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

  // keep the ghost-mode set fresh for this user
  const meGhost = await User.findById(userId).select("ghostMode").lean();
  if (meGhost?.ghostMode) ghostUsers.add(userId);
  else ghostUsers.delete(userId);

  await broadcastOnline();

  // relay typing state to the other participant — unless I'm a ghost (hidden)
  socket.on("typing", ({ to, isTyping }) => {
    if (typeof to !== "string" || ghostUsers.has(userId)) return;
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

  // WebRTC call signaling (relay only)
  socket.on("call:offer", ({ to, offer, video, fromName, fromPic }) => {
    if (typeof to !== "string") return;
    // ghost mode = do-not-disturb: auto-decline so the caller's UI cleans up
    if (ghostUsers.has(to)) return void socket.emit("call:reject", { from: to });
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
  // mid-call renegotiation (adding/replacing a video track)
  socket.on("call:renegotiate", ({ to, offer }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("call:renegotiate", { from: userId, offer });
  });
  socket.on("call:renegotiate-answer", ({ to, answer }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("call:renegotiate-answer", { from: userId, answer });
  });

  // group / multi-person call signaling (mesh)
  // ring the invitees; remember who can join later (group calls)
  socket.on("gcall:invite", ({ roomId, groupId, to, video, title, fromName, fromPic }) => {
    if (typeof roomId !== "string" || !Array.isArray(to)) return;
    // ghost-mode members are do-not-disturb — don't ring them
    const recipients = to.filter((t): t is string => typeof t === "string" && !ghostUsers.has(t));
    roomMeta.set(roomId, { groupId, notify: new Set<string>([userId, ...recipients]) });
    for (const t of recipients) {
      io.to(userRoom(t)).emit("gcall:incoming", { roomId, from: userId, fromName, fromPic, video: Boolean(video), title, groupId });
    }
  });

  // join the room → learn existing peers, and let them know about me
  socket.on("gcall:join", ({ roomId, groupId, name, pic }) => {
    if (typeof roomId !== "string") return;
    let members = callRooms.get(roomId);
    if (!members) {
      members = new Map();
      callRooms.set(roomId, members);
    }
    const existing = [...members.entries()]
      .filter(([uid]) => uid !== userId)
      .map(([uid, m]) => ({ userId: uid, name: m.name, pic: m.pic }));
    members.set(userId, { name, pic });

    const meta = roomMeta.get(roomId);
    if (!meta) roomMeta.set(roomId, { groupId, notify: new Set([userId]) });
    else {
      if (groupId && !meta.groupId) meta.groupId = groupId;
      meta.notify.add(userId);
    }

    io.to(userRoom(userId)).emit("gcall:peers", { roomId, peers: existing });
    for (const uid of members.keys()) {
      if (uid !== userId) io.to(userRoom(uid)).emit("gcall:peer-joined", { roomId, userId, name, pic });
    }
    broadcastCallState(roomId, true);
  });

  // per-pair SDP / ICE relay, scoped to the room
  socket.on("gcall:offer", ({ roomId, to, offer }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("gcall:offer", { roomId, from: userId, offer });
  });
  socket.on("gcall:answer", ({ roomId, to, answer }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("gcall:answer", { roomId, from: userId, answer });
  });
  socket.on("gcall:ice", ({ roomId, to, candidate }) => {
    if (typeof to === "string") io.to(userRoom(to)).emit("gcall:ice", { roomId, from: userId, candidate });
  });
  socket.on("gcall:leave", ({ roomId }) => {
    if (typeof roomId === "string") leaveCallRoom(roomId, userId);
  });

  socket.on("disconnect", async () => {
    socketConnectionsActive.dec();
    // drop out of any group calls this socket was in
    for (const roomId of [...callRooms.keys()]) leaveCallRoom(roomId, userId);
    const online = await getOnlineUserIds();
    // if this was the user's last device, stamp their last-seen time + drop ghost flag
    if (!online.includes(userId)) {
      ghostUsers.delete(userId);
      await User.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } }).catch(() => {});
    }
    io.emit("getOnlineUsers", online.filter((id) => !ghostUsers.has(id)));
  });
});

export { io, app, server, userRoom, redisEnabled };
