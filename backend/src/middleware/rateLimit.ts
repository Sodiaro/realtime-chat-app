import rateLimit from "express-rate-limit";
import { env } from "../lib/env.js";

const skip = () => env.NODE_ENV === "test";

// tight cap on login/signup to slow down brute-force attempts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many attempts, please try again later." },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many requests, please slow down." },
});

// tighter cap for resource-creation (communities, invites) to curb spam/abuse
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "You're creating things too quickly — try again later." },
});
