import ScheduledMessage from "../models/scheduledMessage.model.js";
import { deliverScheduled } from "./deliver.js";
import { logger } from "./logger.js";

const TICK_MS = 15_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

// Find due scheduled messages and dispatch them. Each row is claimed atomically
// (pending -> sent) before delivery so overlapping ticks (or nodes) never
// double-send. Without Redis this is the single source of truth; it's cheap and
// degrades fine on a single node.
async function tick() {
  if (running) return; // never let ticks overlap
  running = true;
  try {
    const due = await ScheduledMessage.find({
      status: "pending",
      scheduledAt: { $lte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(50);

    for (const sm of due) {
      const claim = await ScheduledMessage.updateOne(
        { _id: sm._id, status: "pending" },
        { $set: { status: "sent" } }
      );
      if (claim.modifiedCount !== 1) continue; // already claimed elsewhere

      try {
        const id = await deliverScheduled(sm);
        if (id) await ScheduledMessage.updateOne({ _id: sm._id }, { $set: { sentMessageId: id } });
      } catch (err) {
        logger.error({ err, scheduledId: String(sm._id) }, "failed to deliver scheduled message");
      }
    }
  } catch (err) {
    logger.error({ err }, "scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  timer.unref?.(); // don't keep the process alive just for the poller
  logger.info("scheduled-message poller started");
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

// exported for tests / manual flush
export { tick as flushDueScheduledMessages };
