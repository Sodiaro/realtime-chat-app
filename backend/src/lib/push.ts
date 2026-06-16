import webpush from "web-push";
import { env } from "./env.js";
import { logger } from "./logger.js";
import PushSubscription from "../models/pushSubscription.model.js";

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

// best-effort: send a push to every subscription of the given users
export async function sendPush(userIds: string[], payload: PushPayload) {
  if (!pushEnabled || userIds.length === 0) return;
  const subs = await PushSubscription.find({ userId: { $in: userIds } }).lean();
  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          data
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410 = subscription gone → clean it up
        if (code === 404 || code === 410) {
          await PushSubscription.deleteOne({ endpoint: s.endpoint });
        } else {
          logger.warn({ err: (err as Error).message }, "web push failed");
        }
      }
    })
  );
}
