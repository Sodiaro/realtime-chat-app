import mongoose from "mongoose";

import "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { connectDB } from "./lib/db.js";
import { server, io } from "./lib/socket.js";

const PORT = env.PORT;

await connectDB();

server.listen(PORT, () => {
  logger.info(`server is running on PORT:${PORT}`);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
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
