import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const NOTIFICATIONS_QUEUE = "notifications";

export interface NewMessageJob {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
}

// Background jobs need Redis. Without it, producers become no-ops so the rest
// of the app keeps working single-node.
let notificationsQueue: Queue | null = null;

if (env.REDIS_URL) {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  notificationsQueue = new Queue(NOTIFICATIONS_QUEUE, {
    connection: connection as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: false, // keep failures for inspection / DLQ
    },
  });
} else {
  logger.warn("REDIS_URL not set — background jobs are disabled");
}

export async function enqueueNewMessageNotification(data: NewMessageJob) {
  if (!notificationsQueue) return;
  try {
    await notificationsQueue.add("new-message", data);
  } catch (err) {
    // a notification failure must never fail the message send
    logger.error({ err }, "failed to enqueue notification");
  }
}
