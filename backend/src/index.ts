import mongoose from "mongoose";

import "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { connectDB } from "./lib/db.js";
import { server, io } from "./lib/socket.js";
import { startScheduler, stopScheduler } from "./lib/scheduler.js";

const PORT = env.PORT;

await connectDB();

server.listen(PORT, () => {
  logger.info(`server is running on PORT:${PORT}`);
  startScheduler(); // deliver scheduled messages when they come due
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  stopScheduler();
  io.close();
  server.close(async () => {
    await mongoose.connection.close();
    logger.info("Closed out remaining connections.");
    process.exit(0);
  });

  // bail out if cleanup hangs
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
