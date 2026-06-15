import mongoose from "mongoose";

import "./app.js"; // configures the Express app (middleware + routes)
import { env } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { server, io } from "./lib/socket.js";

const PORT = env.PORT;

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
