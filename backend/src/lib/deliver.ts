import type { Types } from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import type { IScheduledMessage } from "../models/scheduledMessage.model.js";
import { io, userRoom, getOnlineUserIds } from "./socket.js";
import { sendPush } from "./push.js";
import { messagesSentTotal } from "./metrics.js";

// true if either user has blocked the other
async function blockedBetween(aId: string, bId: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    User.findById(aId).select("blockedUsers").lean(),
    User.findById(bId).select("blockedUsers").lean(),
  ]);
  return Boolean(
    a?.blockedUsers?.some((x) => String(x) === bId) ||
      b?.blockedUsers?.some((x) => String(x) === aId)
  );
}

const preview = (sm: Pick<IScheduledMessage, "text" | "image" | "file">) =>
  sm.text || (sm.image ? "📷 Photo" : sm.file ? "📎 File" : "New message");

// Turn a due scheduled message into a real message: persist it, bump the
// conversation, emit to every participant (including the sender's own devices,
// so their open chat updates), and push to anyone offline.
export async function deliverScheduled(
  sm: IScheduledMessage
): Promise<Types.ObjectId | null> {
  const conv = await Conversation.findById(sm.conversationId);
  if (!conv) return null;

  const senderId = String(sm.senderId);
  const participants = conv.participants.map(String);

  // honour blocks that may have happened after scheduling (DMs only)
  if (sm.receiverId && (await blockedBetween(senderId, String(sm.receiverId)))) return null;

  const online = await getOnlineUserIds();
  const deliveredAt =
    sm.receiverId && online.includes(String(sm.receiverId)) ? new Date() : undefined;

  const message = await new Message({
    conversationId: conv._id,
    senderId: sm.senderId,
    receiverId: sm.receiverId,
    text: sm.text,
    image: sm.image,
    file: sm.file,
    deliveredAt,
    expiresAt: conv.disappearMinutes ? new Date(Date.now() + conv.disappearMinutes * 60_000) : undefined,
  }).save();
  messagesSentTotal.inc();

  const unreadInc: Record<string, number> = {};
  for (const p of participants) if (p !== senderId) unreadInc[`unread.${p}`] = 1;
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { lastMessage: message._id, lastMessageAt: message.createdAt }, $inc: unreadInc }
  );

  // every participant, the sender included, so a scheduled send shows up live
  for (const p of participants) io.to(userRoom(p)).emit("newMessage", message);

  const offline = participants.filter((p) => p !== senderId && !online.includes(p));
  if (offline.length) {
    const sender = await User.findById(senderId).select("fullName").lean();
    sendPush(offline, {
      title: `${sender?.fullName ?? "DevChat"}${conv.name ? " · " + conv.name : ""}`,
      body: preview(sm),
    }).catch(() => {});
  }

  return message._id;
}
