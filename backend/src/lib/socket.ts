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
import type { IMessage } from "../models/message.model.js";

interface ServerToClientEvents {
  newMessage: (message: IMessage) => void;
  getOnlineUsers: (userIds: string[]) => void;
}

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

  socket.on("disconnect", async () => {
    socketConnectionsActive.dec();
    io.emit("getOnlineUsers", await getOnlineUserIds());
  });
});

export { io, app, server, userRoom, redisEnabled };
