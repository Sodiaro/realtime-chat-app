import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // no DB, no point staying up — bail so the platform restarts us
    logger.error({ err: error }, "MongoDB connection error");
    process.exit(1);
  }
};
