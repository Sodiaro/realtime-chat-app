import pino from "pino";
import { env } from "./env.js";

const isDev = env.NODE_ENV === "development";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : process.env.LOG_LEVEL || "info",
  // never log secrets
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "password"],
  // pretty output in dev, raw JSON everywhere else
  ...(isDev ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
});
