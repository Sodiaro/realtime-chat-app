import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { parse as parseCookie } from "cookie";
import { corsOrigins } from "./env.js";
import type { IMessage } from "../models/message.model.js";

interface ServerToClientEvents {
  newMessage: (message: IMessage) => void;
  getOnlineUsers: (userIds: string[]) => void;
}

// no client→server events yet (Phase C)
interface ClientToServerEvents {}

const app = express();
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

export function getReceiverSocketId(userId: string): string | undefined {
  return userSocketMap[userId];
}

// used to store online users  {userId: socketId}
const userSocketMap: Record<string, string> = {};

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

io.on("connection", (socket) => {
  const userId = socket.userId!;
  userSocketMap[userId] = socket.id;

  socket.join(`user:${userId}`);

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
