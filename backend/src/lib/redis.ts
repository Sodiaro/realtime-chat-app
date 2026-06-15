import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisEnabled = Boolean(env.REDIS_URL);

// pub/sub pair for the Socket.IO adapter
export function createAdapterClients() {
  if (!env.REDIS_URL) return null;
  const pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  return { pubClient, subClient };
}
