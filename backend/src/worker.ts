import { Worker, Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { NOTIFICATIONS_QUEUE, type NewMessageJob } from "./lib/queues.js";

if (!env.REDIS_URL) {
  logger.error("worker requires REDIS_URL");
  process.exit(1);
}

const redisConn = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const connection = redisConn as unknown as ConnectionOptions;
const deadLetter = new Queue(`${NOTIFICATIONS_QUEUE}-dlq`, { connection });

const worker = new Worker<NewMessageJob>(
  NOTIFICATIONS_QUEUE,
  async (job) => {
    logger.info(
      { jobId: job.id, receiverId: job.data.receiverId, messageId: job.data.messageId },
      "processing new-message notification"
    );
  },
  { connection, concurrency: 10 }
);

worker.on("failed", async (job, err) => {
  logger.error({ jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, "notification job failed");
  // once retries are exhausted, move it to the dead-letter queue
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await deadLetter.add("dead", { data: job.data, error: err.message });
    logger.warn({ jobId: job.id }, "moved to dead-letter queue");
  }
});

logger.info("notifications worker started");

const shutdown = async () => {
  await worker.close();
  await deadLetter.close();
  await redisConn.quit();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
