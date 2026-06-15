import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { parse as parseCookie } from "cookie";
import { createAdapter } from "@socket.io/redis-adapter";
import { corsOrigins } from "./env.js";
import { createAdapterClients, redisEnabled } from "./redis.js";
import type { IMessage } from "../models/message.model.js";

interface ServerToClientEvents {
  newMessage: (message: IMessage) => void;
  getOnlineUsers: (userIds: string[]) => void;
}

// no client→server events yet
interface ClientToServerEvents {}

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
  console.log("Socket.IO Redis adapter enabled (multi-node)");
}

const userRoom = (userId: string) => `user:${userId}`;

// Online users are derived from the user:* rooms, so it works across nodes and
// counts a user online until their last device disconnects.
export async function getOnlineUserIds(): Promise<string[]> {
  const adapter = io.of("/").adapter as unknown as {
    allRooms(): Promise<Set<string>>;
  };
  const rooms = await adapter.allRooms();
  return [...rooms].filter((r) => r.startsWith("user:")).map((r) => r.slice(5));
}

// take userId from the verified JWT, not the handshake query — clients can fake that
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

  io.emit("getOnlineUsers", await getOnlineUserIds());

  socket.on("disconnect", async () => {
    // rooms are already left by now, so this reflects the post-disconnect state
    io.emit("getOnlineUsers", await getOnlineUserIds());
  });
});

export { io, app, server, userRoom, redisEnabled };
