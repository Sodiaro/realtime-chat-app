import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import path from "path";

import { openapiSpec } from "./lib/swagger.js";
import { env, corsOrigins } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { app, server, io } from "./lib/socket.js";

const PORT = env.PORT;
const __dirname = path.resolve();

app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// API docs — relax CSP here so Swagger UI's assets load
app.get("/api-docs.json", (_req, res) => res.json(openapiSpec));
app.use(
  "/api-docs",
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: "DevChat API" })
);

// keep these above the rate limiter and SPA catch-all
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

app.use(errorHandler); // must stay last

// DB up before we accept any traffic
await connectDB();

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  io.close();
  server.close(async () => {
    await mongoose.connection.close();
    console.log("Closed out remaining connections.");
    process.exit(0);
  });

  // bail out if cleanup hangs
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
