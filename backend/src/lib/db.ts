import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // no DB, no point staying up — bail so the platform restarts us
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
