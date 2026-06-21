import type { RequestHandler } from "express";
import crypto from "crypto";
import mongoose, { type Types } from "mongoose";
import User from "../models/user.model.js";
import Message, { type IMessage } from "../models/message.model.js";
import Conversation, { getOrCreateDirect } from "../models/conversation.model.js";
import ScheduledMessage from "../models/scheduledMessage.model.js";
import Report from "../models/report.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userRoom, getOnlineUserIds } from "../lib/socket.js";
import { enqueueNewMessageNotification } from "../lib/queues.js";
import { sendPush } from "../lib/push.js";
import { messagesSentTotal } from "../lib/metrics.js";

const messagePreview = (m: {
  text?: string;
  image?: string;
  audio?: string;
  file?: unknown;
  poll?: unknown;
  location?: unknown;
  contact?: unknown;
}) =>
  m.text ||
  (m.image
    ? "📷 Photo"
    : m.audio
      ? "🎤 Voice note"
      : m.file
        ? "📎 File"
        : m.poll
          ? "📊 Poll"
          : m.location
            ? "📍 Location"
            : m.contact
              ? "👤 Contact"
              : "New message");

// build a poll subdocument from a {question, options[], multiple} payload
function buildPoll(poll: { question?: string; options?: string[]; multiple?: boolean } | undefined) {
  if (!poll?.question || !Array.isArray(poll.options) || poll.options.length < 2) return undefined;
  return {
    question: String(poll.question).trim(),
    options: poll.options.slice(0, 10).map((t) => ({ text: String(t).trim(), votes: [] })),
    multiple: Boolean(poll.multiple),
  };
}

// validate a shared location ({lat, lng} within range)
function buildLocation(loc: { lat?: number; lng?: number; label?: string } | undefined) {
  if (!loc) return undefined;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return undefined;
  }
  return { lat, lng, label: loc.label ? String(loc.label).slice(0, 120) : undefined };
}

// build a shared-contact card (name required)
function buildContact(
  c: { userId?: string; name?: string; username?: string; avatar?: string } | undefined
) {
  if (!c?.name?.trim()) return undefined;
  return {
    userId: c.userId || undefined,
    name: String(c.name).trim().slice(0, 120),
    username: c.username ? String(c.username).slice(0, 60) : undefined,
    avatar: c.avatar ? String(c.avatar) : undefined,
  };
}

// fetch OpenGraph metadata for the first URL in the text, then patch the message + notify
async function applyLinkPreview(message: { _id: unknown; text?: string }) {
  const url = message.text?.match(/https?:\/\/[^\s]+/)?.[0];
  if (!url) return;
  try {
    const { hostname } = new URL(url);
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return; // no SSRF to internal
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "DevChatBot/1.0" } });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 200_000);
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
    const title = meta("og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const description = meta("og:description") || meta("description");
    const image = meta("og:image");
    if (!title && !description && !image) return;
    const updated = await Message.findByIdAndUpdate(
      message._id,
      { linkPreview: { url, title, description, image } },
      { new: true }
    );
    if (updated) await emitMessageUpdate(updated);
  } catch {
    /* preview is best-effort */
  }
}

// messages can only be edited/deleted within 10 minutes of sending
const EDIT_WINDOW_MS = 10 * 60 * 1000;

// exclude disappearing messages that have already expired (TTL deletes lag ~60s)
const notExpired = () => ({
  $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
});

const computeExpiry = (minutes?: number) =>
  minutes && minutes > 0 ? new Date(Date.now() + minutes * 60_000) : undefined;

export const MAX_GROUP_MEMBERS = 200;

// view-once: hide content from recipients until they open it, and forever after.
// the sender always sees their own; recipients get a content-less placeholder
// (with a type hint) until/after viewing.
function redactViewOnce(msg: Record<string, unknown>, myId: string): Record<string, unknown> {
  if (!msg.viewOnce) return msg;
  const isSender = String(msg.senderId) === myId;
  const viewedBy = (msg.viewedBy as unknown[]) || [];
  const viewed = viewedBy.some((v) => String(v) === myId);
  const kind = msg.image ? "photo" : msg.audio ? "voice" : msg.file ? "file" : "text";
  // content NEVER ships in the list — not even to the sender. Only the one-time
  // /view endpoint serves it, once, to a recipient who hasn't opened it yet.
  return {
    ...msg,
    text: undefined,
    image: undefined,
    audio: undefined,
    file: undefined,
    location: undefined,
    contact: undefined,
    viewOnceKind: kind,
    viewOnceConsumed: isSender ? undefined : viewed,
    viewOnceOpened: isSender ? viewedBy.length > 0 : undefined, // sender sees "opened" status
  };
}

// hide a user's last-seen / profile photo based on their privacy settings.
// `isContact` is true when the viewer shares a DM with them.
type Vis = "everyone" | "contacts" | "nobody";
interface PrivacyView {
  profilePic?: string;
  lastSeen?: unknown;
  privacy?: { lastSeen?: Vis; profilePhoto?: Vis };
  ghostMode?: boolean;
}
const visibleTo = (setting: Vis | undefined, isContact: boolean) =>
  !setting || setting === "everyone" || (setting === "contacts" && isContact);

function applyPrivacy<T extends PrivacyView>(u: T, isContact: boolean): T {
  const out: T = { ...u };
  // ghost mode always hides last-seen (and ghostMode itself stays visible as a badge)
  if (out.ghostMode || !visibleTo(out.privacy?.lastSeen, isContact)) delete (out as PrivacyView).lastSeen;
  if (!visibleTo(out.privacy?.profilePhoto, isContact)) (out as PrivacyView).profilePic = "";
  delete (out as PrivacyView).privacy;
  return out;
}

// only people the user has actually talked to (their DM contacts)
export const getUsersForSidebar: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const convs = await Conversation.find({ isGroup: false, participants: myId })
      .populate("participants", "fullName username profilePic bio status lastSeen privacy ghostMode")
      .lean();

    const seen = new Set<string>();
    const contacts: unknown[] = [];
    for (const c of convs) {
      const peer = (c.participants as ({ _id: Types.ObjectId } & PrivacyView)[]).find(
        (p) => String(p._id) !== myId
      );
      if (peer && !seen.has(String(peer._id))) {
        seen.add(String(peer._id));
        contacts.push(applyPrivacy(peer, true)); // they're a DM contact
      }
    }
    res.status(200).json(contacts);
  } catch (error) {
    next(error);
  }
};

// find any user by username or name (to start a new chat)
export const searchUsers: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(200).json([]);
      return;
    }
    const users = await User.find({
      _id: { $ne: myId },
      $or: [
        { username: { $regex: q, $options: "i" } },
        { fullName: { $regex: q, $options: "i" } },
      ],
    })
      .select("fullName username profilePic bio status lastSeen privacy ghostMode")
      .limit(20)
      .lean();
    // search reaches strangers, so only "everyone" visibility is exposed here
    res.status(200).json(users.map((u) => applyPrivacy(u as PrivacyView, false)));
  } catch (error) {
    next(error);
  }
};

// the current user's conversations, newest first, with their unread count
export const getConversations: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const conversations = await Conversation.find({ participants: myId })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate("lastMessage")
      .populate("participants", "fullName username profilePic bio status lastSeen");

    const result = conversations.map((c) => ({
      _id: c._id,
      participants: c.participants,
      isGroup: c.isGroup,
      name: c.name,
      avatar: c.avatar,
      description: c.description,
      onlyAdminsCanMessage: c.onlyAdminsCanMessage ?? false,
      admins: c.admins,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unread: c.unread?.get(myId) ?? 0,
      isMuted: c.mutedBy?.some((id) => String(id) === myId) ?? false,
      isArchived: c.archivedBy?.some((id) => String(id) === myId) ?? false,
      isPinned: c.pinnedBy?.some((id) => String(id) === myId) ?? false,
      isAdmin: c.admins?.some((id) => String(id) === myId) ?? false,
      disappearMinutes: c.disappearMinutes ?? 0,
    }));

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getMessages: RequestHandler = async (req, res, next) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user!._id;

    const conversation = await getOrCreateDirect(myId, String(userToChatId));

    // pass ?cursor=<createdAt> to page back through older messages
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const query: Record<string, unknown> = { conversationId: conversation._id, ...notExpired() };
    if (req.query.cursor) {
      query.createdAt = { $lt: new Date(String(req.query.cursor)) };
    }

    // query newest-first for the cursor, hand back oldest→newest for the UI
    const page = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("replyTo", "text senderId image deletedAt")
      .lean();

    const ordered = page.reverse();
    const nextCursor = page.length === limit ? ordered[0]?.createdAt : null;
    const messages = ordered
      .filter((m) => !m.ghostDeleted)
      .map((m) => redactViewOnce(m as unknown as Record<string, unknown>, String(myId)));

    // opening a chat clears my unread for it
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { [`unread.${String(myId)}`]: 0 } }
    );

    res.status(200).json({ messages, nextCursor });
  } catch (error) {
    next(error);
  }
};

// true if either user has blocked the other
async function blockedBetween(aId: string, bId: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    User.findById(aId).select("blockedUsers").lean(),
    User.findById(bId).select("blockedUsers").lean(),
  ]);
  const aBlockedB = a?.blockedUsers?.some((x) => String(x) === bId);
  const bBlockedA = b?.blockedUsers?.some((x) => String(x) === aId);
  return Boolean(aBlockedB || bBlockedA);
}

// resolve @mentions in text to participant user ids (matches first name or full name)
async function resolveMentions(
  text: string | undefined,
  participantIds: Types.ObjectId[]
): Promise<Types.ObjectId[]> {
  if (!text) return [];
  const tokens = (text.match(/@(\w+)/g) || []).map((t) => t.slice(1).toLowerCase());
  if (tokens.length === 0) return [];

  const users = await User.find({ _id: { $in: participantIds } }).select("fullName").lean();
  const matched: Types.ObjectId[] = [];
  for (const u of users) {
    const first = u.fullName.split(" ")[0]?.toLowerCase();
    const full = u.fullName.replace(/\s+/g, "").toLowerCase();
    if ((first && tokens.includes(first)) || tokens.includes(full)) matched.push(u._id);
  }
  return matched;
}

export const sendMessage: RequestHandler = async (req, res, next) => {
  try {
    const { text, image, audio, file, poll, location, contact, replyTo, viewOnce } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user!._id;

    const pollDoc = buildPoll(poll);
    const locationDoc = buildLocation(location);
    const contactDoc = buildContact(contact);
    if (!text && !image && !audio && !file && !pollDoc && !locationDoc && !contactDoc) {
      res.status(400).json({ message: "Message cannot be empty" });
      return;
    }

    // messaging yourself ("Notes" / self-chat) is always allowed
    const isSelf = String(receiverId) === String(senderId);
    if (!isSelf && (await blockedBetween(String(senderId), String(receiverId)))) {
      res.status(403).json({ message: "You can't message this user" });
      return;
    }

    let imageUrl: string | undefined;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl: string | undefined;
    if (audio) {
      // transcode to mp3 so it plays in every browser (webm/opus doesn't)
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        format: "mp3",
      });
      audioUrl = uploadResponse.secure_url;
    }

    let fileDoc;
    if (file?.data) {
      const uploadResponse = await cloudinary.uploader.upload(file.data, { resource_type: "auto" });
      fileDoc = { url: uploadResponse.secure_url, name: file.name || "file", size: file.size || 0, type: file.type || "" };
    }

    const conversation = await getOrCreateDirect(senderId, String(receiverId));

    // if the recipient is online, the message is delivered right away
    const online = await getOnlineUserIds();
    const deliveredAt = isSelf || online.includes(String(receiverId)) ? new Date() : undefined;

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      file: fileDoc,
      poll: pollDoc,
      location: locationDoc,
      contact: contactDoc,
      mentions: await resolveMentions(text, conversation.participants),
      deliveredAt,
      expiresAt: computeExpiry(conversation.disappearMinutes),
      viewOnce: Boolean(viewOnce),
      replyTo: replyTo || undefined,
    });

    await newMessage.save();
    await newMessage.populate("replyTo", "text senderId image deletedAt");
    messagesSentTotal.inc();
    if (!viewOnce) applyLinkPreview(newMessage); // fire-and-forget unfurl (skip for view-once)

    // bump conversation metadata + the receiver's unread count
    const convUpdate: Record<string, unknown> = {
      $set: { lastMessage: newMessage._id, lastMessageAt: newMessage.createdAt },
    };
    if (!isSelf) convUpdate.$inc = { [`unread.${String(receiverId)}`]: 1 };
    await Conversation.updateOne({ _id: conversation._id }, convUpdate);

    // room delivery reaches all of the receiver's devices, on any node
    io.to(userRoom(String(receiverId))).emit("newMessage", newMessage);

    // notes-to-self needs no notification/push
    if (!isSelf) {
      // hand off side-effects (push/email) to the background worker
      await enqueueNewMessageNotification({
        messageId: String(newMessage._id),
        conversationId: String(conversation._id),
        senderId: String(senderId),
        receiverId: String(receiverId),
      });

      // web push to the recipient if they're offline (no live socket)
      if (!online.includes(String(receiverId))) {
        sendPush([String(receiverId)], {
          title: req.user!.fullName,
          body: messagePreview({ text, image: imageUrl, audio: audioUrl, location: locationDoc, contact: contactDoc }),
        }).catch(() => {});
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

// push a message update to both participants (all their devices, any node)
// broadcast a message change to every participant (works for groups + DMs)
async function emitMessageUpdate(message: IMessage) {
  const conv = await Conversation.findById(message.conversationId).select("participants").lean();
  const participants = conv?.participants?.map(String) ?? [
    String(message.senderId),
    String(message.receiverId),
  ];
  for (const p of participants) io.to(userRoom(p)).emit("messageUpdated", message);
}

export const updateMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text || !String(text).trim()) {
      res.status(400).json({ message: "Text is required" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (String(message.senderId) !== myId) {
      res.status(403).json({ message: "You can only edit your own messages" });
      return;
    }
    if (message.deletedAt) {
      res.status(400).json({ message: "Cannot edit a deleted message" });
      return;
    }
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
      res.status(403).json({ message: "Messages can only be edited within 10 minutes" });
      return;
    }

    message.text = String(text).trim();
    // ghost mode: edit silently — leave no "edited" indicator
    if (!req.user!.ghostMode) message.editedAt = new Date();
    await message.save();

    await emitMessageUpdate(message);
    res.status(200).json(message);
  } catch (error) {
    next(error);
  }
};

export const deleteMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (String(message.senderId) !== myId) {
      res.status(403).json({ message: "You can only delete your own messages" });
      return;
    }
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
      res.status(403).json({ message: "Messages can only be deleted within 10 minutes" });
      return;
    }

    // soft delete: keep the row so history stays consistent
    message.deletedAt = new Date();
    message.text = undefined;
    message.image = undefined;
    message.reactions = [];
    // ghost mode: remove silently — clients hide it entirely (no "deleted" tombstone)
    if (req.user!.ghostMode) message.ghostDeleted = true;
    await message.save();

    await emitMessageUpdate(message);
    res.status(200).json(message);
  } catch (error) {
    next(error);
  }
};

export const reactToMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== "string") {
      res.status(400).json({ message: "Emoji is required" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (message.deletedAt) {
      res.status(400).json({ message: "Cannot react to a deleted message" });
      return;
    }
    if (String(message.senderId) !== myId && String(message.receiverId) !== myId) {
      res.status(403).json({ message: "Not a participant of this message" });
      return;
    }

    const reactions = message.reactions ?? [];
    const mine = reactions.findIndex((r) => String(r.userId) === myId);
    if (mine >= 0) {
      // same emoji toggles off, a different one replaces
      if (reactions[mine]!.emoji === emoji) reactions.splice(mine, 1);
      else reactions[mine]!.emoji = emoji;
    } else {
      reactions.push({ userId: req.user!._id, emoji });
    }
    message.reactions = reactions;
    await message.save();

    await emitMessageUpdate(message);
    res.status(200).json(message);
  } catch (error) {
    next(error);
  }
};

export const searchMessages: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const q = String(req.query.q || "").trim();
    const withUser = String(req.query.with || "");

    if (!q) {
      res.status(400).json({ message: "Search query is required" });
      return;
    }

    const filter: Record<string, unknown> = {
      deletedAt: { $exists: false },
      text: { $regex: q, $options: "i" },
    };
    if (withUser) {
      const conv = await getOrCreateDirect(myId, withUser);
      filter.conversationId = conv._id;
    } else {
      filter.$or = [{ senderId: myId }, { receiverId: myId }];
    }

    const results = await Message.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

// all shared media/files/links in a conversation (whole history, not just the page)
export const getSharedMedia: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const type = String(req.query.type || "media");

    const conv = await Conversation.findById(conversationId).select("participants").lean();
    if (!conv || !conv.participants.map(String).includes(myId)) {
      return void res.status(403).json({ message: "Not a participant" });
    }

    const filter: Record<string, unknown> = { conversationId, deletedAt: { $exists: false } };
    if (type === "files") filter.file = { $exists: true, $ne: null };
    else if (type === "links") filter.linkPreview = { $exists: true, $ne: null };
    else filter.image = { $exists: true, $ne: null }; // "media" = photos

    const items = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(120)
      .select("image file linkPreview senderId createdAt")
      .lean();
    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
};

export const pinMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (String(message.senderId) !== myId && String(message.receiverId) !== myId) {
      res.status(403).json({ message: "Not a participant of this message" });
      return;
    }

    // toggle pin
    message.pinnedAt = message.pinnedAt ? undefined : new Date();
    await message.save();
    await message.populate("replyTo", "text senderId image deletedAt");

    await emitMessageUpdate(message);
    res.status(200).json(message);
  } catch (error) {
    next(error);
  }
};

export const votePoll: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;
    const idx = Number(req.body.optionIndex);

    const message = await Message.findById(messageId);
    if (!message?.poll) {
      res.status(404).json({ message: "Poll not found" });
      return;
    }
    const conv = await Conversation.findById(message.conversationId);
    if (!conv || !conv.participants.map(String).includes(myId)) {
      res.status(403).json({ message: "Not a participant" });
      return;
    }
    if (Number.isNaN(idx) || idx < 0 || idx >= message.poll.options.length) {
      res.status(400).json({ message: "Invalid option" });
      return;
    }

    const opt = message.poll.options[idx]!;
    const voted = opt.votes.some((v) => String(v) === myId);
    if (!message.poll.multiple) {
      message.poll.options.forEach((o) => {
        o.votes = o.votes.filter((v) => String(v) !== myId);
      });
    }
    if (voted) {
      opt.votes = opt.votes.filter((v) => String(v) !== myId); // unvote
    } else {
      opt.votes.push(req.user!._id);
    }
    message.markModified("poll");
    await message.save();
    await emitMessageUpdate(message);
    res.status(200).json(message);
  } catch (error) {
    next(error);
  }
};

// forward a message to a DM (body.to = userId) or a group/conversation
// (body.conversationId). Works for any source→target combination.
export const forwardMessage: RequestHandler = async (req, res, next) => {
  try {
    const senderId = req.user!._id;
    const myId = String(senderId);
    const { messageId } = req.params;
    const to: string | undefined = req.body.to;
    const targetConvId: string | undefined = req.body.conversationId;

    if (!to && !targetConvId) {
      res.status(400).json({ message: "Recipient is required" });
      return;
    }

    const original = await Message.findById(messageId);
    if (!original) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (original.deletedAt || original.call || original.system) {
      res.status(400).json({ message: "This message can't be forwarded" });
      return;
    }

    // the forwarder must belong to the source conversation
    const src = await Conversation.findById(original.conversationId).select("participants").lean();
    if (!src || !src.participants.map(String).includes(myId)) {
      res.status(403).json({ message: "Not a participant of this message" });
      return;
    }

    // resolve the target conversation (group by id, or 1:1 by user id)
    let target;
    let receiverId: string | undefined;
    if (targetConvId) {
      target = await Conversation.findById(targetConvId);
      if (!target) {
        res.status(404).json({ message: "Conversation not found" });
        return;
      }
      if (!target.participants.map(String).includes(myId)) {
        res.status(403).json({ message: "Not a participant" });
        return;
      }
      if (target.onlyAdminsCanMessage && !target.admins.map(String).includes(myId)) {
        res.status(403).json({ message: "Only admins can post in this group" });
        return;
      }
    } else {
      if (await blockedBetween(myId, to!)) {
        res.status(403).json({ message: "You can't message this user" });
        return;
      }
      target = await getOrCreateDirect(senderId, to!);
      receiverId = to;
    }

    const participants = target.participants.map(String);
    const newMessage = new Message({
      conversationId: target._id,
      senderId,
      receiverId, // undefined for groups
      text: original.text,
      image: original.image,
      audio: original.audio,
      file: original.file,
      location: original.location,
      contact: original.contact,
      forwardedFrom: original.senderId,
      expiresAt: computeExpiry(target.disappearMinutes),
    });
    await newMessage.save();
    messagesSentTotal.inc();

    const unreadInc: Record<string, number> = {};
    for (const p of participants) if (p !== myId) unreadInc[`unread.${p}`] = 1;
    await Conversation.updateOne(
      { _id: target._id },
      { $set: { lastMessage: newMessage._id, lastMessageAt: newMessage.createdAt }, $inc: unreadInc }
    );

    for (const p of participants) if (p !== myId) io.to(userRoom(p)).emit("newMessage", newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

export const reportMessage: RequestHandler = async (req, res, next) => {
  try {
    const reporterId = req.user!._id;
    const { messageId } = req.params;
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      res.status(400).json({ message: "A reason is required" });
      return;
    }
    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    await new Report({ reporterId, messageId, reason: String(reason).trim() }).save();
    res.status(201).json({ message: "Reported. Thanks for flagging this." });
  } catch (error) {
    next(error);
  }
};

// open a view-once message: returns its content once, then marks it consumed
export const viewMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return void res.status(404).json({ message: "Message not found" });
    if (!message.viewOnce) return void res.status(400).json({ message: "Not a view-once message" });

    const conv = await Conversation.findById(message.conversationId).select("participants").lean();
    if (!conv || !conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not a participant" });

    // the sender can never reopen their own view-once content
    if (String(message.senderId) === myId)
      return void res.status(403).json({ message: "You can't open your own view-once message" });
    // a recipient gets exactly one view
    if (message.viewedBy.some((v) => String(v) === myId))
      return void res.status(410).json({ message: "This message has already been viewed" });

    message.viewedBy.push(req.user!._id);
    await message.save();
    // let the sender's bubble flip to "Opened"
    io.to(userRoom(String(message.senderId))).emit("messageViewed", {
      messageId: String(message._id),
      by: myId,
    });

    res.status(200).json({
      text: message.text,
      image: message.image,
      audio: message.audio,
      file: message.file,
      location: message.location,
      contact: message.contact,
    });
  } catch (error) {
    next(error);
  }
};

// group chats

// case-insensitive group-name uniqueness. Scope: within a community for
// community groups, otherwise globally among standalone groups.
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function groupNameTaken(
  name: string,
  opts: { communityId?: Types.ObjectId | null; excludeId?: Types.ObjectId | string } = {}
): Promise<boolean> {
  const query: Record<string, unknown> = {
    isGroup: true,
    isAnnouncement: { $ne: true },
    name: new RegExp(`^${escRe(name.trim())}$`, "i"),
    communityId: opts.communityId ? opts.communityId : { $exists: false },
  };
  if (opts.excludeId) query._id = { $ne: opts.excludeId };
  return Boolean(await Conversation.findOne(query).select("_id").lean());
}

export const createGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { name, members } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ message: "Group name is required" });
      return;
    }
    if (!Array.isArray(members) || members.length < 1) {
      res.status(400).json({ message: "Add at least one member" });
      return;
    }
    const cleanName = String(name).trim();
    if (await groupNameTaken(cleanName)) {
      res.status(409).json({ message: "A group with that name already exists" });
      return;
    }

    const participants = Array.from(new Set([String(myId), ...members.map(String)]));
    if (participants.length > MAX_GROUP_MEMBERS) {
      res.status(400).json({ message: `Groups can have at most ${MAX_GROUP_MEMBERS} members` });
      return;
    }
    const conversation = new Conversation({
      key: `group:${new mongoose.Types.ObjectId().toString()}`,
      participants,
      isGroup: true,
      name: cleanName,
      nameKey: `g:${cleanName.toLowerCase()}`,
      admins: [myId],
    });
    await conversation.save();

    // let online members pick it up immediately
    for (const p of participants) {
      if (p !== String(myId)) io.to(userRoom(p)).emit("conversationCreated", conversation);
    }

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }
    if (!conversation.participants.map(String).includes(String(myId))) {
      res.status(403).json({ message: "Not a participant" });
      return;
    }

    // group read receipts: record that I've now read everyone else's messages
    const read = await Message.updateMany(
      { conversationId, senderId: { $ne: myId }, readBy: { $ne: myId } },
      { $addToSet: { readBy: myId } }
    );
    if (read.modifiedCount > 0) {
      for (const p of conversation.participants.map(String)) {
        if (p !== String(myId)) {
          io.to(userRoom(p)).emit("groupMessagesRead", {
            conversationId: String(conversation._id),
            userId: String(myId),
          });
        }
      }
    }

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const query: Record<string, unknown> = { conversationId, ...notExpired() };
    if (req.query.cursor) query.createdAt = { $lt: new Date(String(req.query.cursor)) };

    const page = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("replyTo", "text senderId image deletedAt")
      .lean();

    const ordered = page.reverse();
    const nextCursor = page.length === limit ? ordered[0]?.createdAt : null;
    const messages = ordered
      .filter((m) => !m.ghostDeleted)
      .map((m) => redactViewOnce(m as unknown as Record<string, unknown>, String(myId)));

    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { [`unread.${String(myId)}`]: 0 } }
    );

    res.status(200).json({ messages, nextCursor });
  } catch (error) {
    next(error);
  }
};

export const sendToConversation: RequestHandler = async (req, res, next) => {
  try {
    const senderId = req.user!._id;
    const { conversationId } = req.params;
    const { text, image, audio, file, poll, location, contact, replyTo, viewOnce } = req.body;

    const pollDoc = buildPoll(poll);
    const locationDoc = buildLocation(location);
    const contactDoc = buildContact(contact);
    if (!text && !image && !audio && !file && !pollDoc && !locationDoc && !contactDoc) {
      res.status(400).json({ message: "Message cannot be empty" });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }
    const participants = conversation.participants.map(String);
    if (!participants.includes(String(senderId))) {
      res.status(403).json({ message: "Not a participant" });
      return;
    }
    // admins-only posting (group setting)
    if (conversation.onlyAdminsCanMessage && !conversation.admins.map(String).includes(String(senderId))) {
      res.status(403).json({ message: "Only admins can post in this group" });
      return;
    }

    let imageUrl: string | undefined;
    if (image) imageUrl = (await cloudinary.uploader.upload(image)).secure_url;
    let audioUrl: string | undefined;
    if (audio)
      audioUrl = (
        await cloudinary.uploader.upload(audio, { resource_type: "video", format: "mp3" })
      ).secure_url;
    let fileDoc;
    if (file?.data) {
      const up = await cloudinary.uploader.upload(file.data, { resource_type: "auto" });
      fileDoc = { url: up.secure_url, name: file.name || "file", size: file.size || 0, type: file.type || "" };
    }

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      text,
      image: imageUrl,
      audio: audioUrl,
      file: fileDoc,
      poll: pollDoc,
      location: locationDoc,
      contact: contactDoc,
      mentions: await resolveMentions(text, conversation.participants),
      expiresAt: computeExpiry(conversation.disappearMinutes),
      viewOnce: Boolean(viewOnce),
      replyTo: replyTo || undefined,
    });
    await newMessage.save();
    await newMessage.populate("replyTo", "text senderId image deletedAt");
    messagesSentTotal.inc();
    if (!viewOnce) applyLinkPreview(newMessage); // fire-and-forget unfurl (skip for view-once)

    const unreadInc: Record<string, number> = {};
    for (const p of participants) if (p !== String(senderId)) unreadInc[`unread.${p}`] = 1;
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { lastMessage: newMessage._id, lastMessageAt: newMessage.createdAt }, $inc: unreadInc }
    );

    const online = await getOnlineUserIds();
    for (const p of participants) {
      if (p !== String(senderId)) io.to(userRoom(p)).emit("newMessage", newMessage);
    }

    const offline = participants.filter((p) => p !== String(senderId) && !online.includes(p));
    if (offline.length) {
      sendPush(offline, {
        title: `${req.user!.fullName}${conversation.name ? " · " + conversation.name : ""}`,
        body: messagePreview({ text, image: imageUrl, audio: audioUrl, location: locationDoc, contact: contactDoc }),
      }).catch(() => {});
    }

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

// notify every participant that a conversation's metadata changed
async function emitConversationUpdated(conversationId: Types.ObjectId) {
  const conv = await Conversation.findById(conversationId).populate("participants", "-password");
  if (!conv) return;
  for (const p of conv.participants) {
    io.to(userRoom(String((p as { _id?: unknown })._id ?? p))).emit("conversationUpdated", conv);
  }
}

// mute / archive (per user)

export const toggleMute: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv) return void res.status(404).json({ message: "Conversation not found" });
    if (!conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not a participant" });

    const muted = conv.mutedBy.some((id) => String(id) === myId);
    await Conversation.updateOne(
      { _id: conv._id },
      muted ? { $pull: { mutedBy: myId } } : { $addToSet: { mutedBy: myId } }
    );
    res.status(200).json({ isMuted: !muted });
  } catch (error) {
    next(error);
  }
};

export const toggleArchive: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv) return void res.status(404).json({ message: "Conversation not found" });
    if (!conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not a participant" });

    const archived = conv.archivedBy.some((id) => String(id) === myId);
    await Conversation.updateOne(
      { _id: conv._id },
      archived ? { $pull: { archivedBy: myId } } : { $addToSet: { archivedBy: myId } }
    );
    res.status(200).json({ isArchived: !archived });
  } catch (error) {
    next(error);
  }
};

export const togglePin: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv) return void res.status(404).json({ message: "Conversation not found" });
    if (!conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not a participant" });

    const pinned = conv.pinnedBy.some((id) => String(id) === myId);
    await Conversation.updateOne(
      { _id: conv._id },
      pinned ? { $pull: { pinnedBy: myId } } : { $addToSet: { pinnedBy: myId } }
    );
    res.status(200).json({ isPinned: !pinned });
  } catch (error) {
    next(error);
  }
};

export const setDisappearing: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const minutes = Number(req.body.minutes) || 0;

    const conv = await Conversation.findById(conversationId);
    if (!conv) return void res.status(404).json({ message: "Conversation not found" });
    if (!conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not a participant" });

    const wasOn = (conv.disappearMinutes ?? 0) > 0;
    const nowOn = minutes > 0;
    conv.disappearMinutes = nowOn ? minutes : undefined;
    await conv.save();
    await emitConversationUpdated(conv._id);

    // drop a system notice into the timeline for both participants when toggled
    if (wasOn !== nowOn) {
      // for DMs, target the other participant so it routes into the open chat
      const others = conv.participants.map(String).filter((p) => p !== myId);
      const sysMsg = await new Message({
        conversationId: conv._id,
        senderId: myId,
        receiverId: conv.isGroup ? undefined : others[0],
        system: { type: "disappearing", on: nowOn },
      }).save();
      await Conversation.updateOne(
        { _id: conv._id },
        { $set: { lastMessage: sysMsg._id, lastMessageAt: sysMsg.createdAt } }
      );
      for (const p of conv.participants) io.to(userRoom(String(p))).emit("newMessage", sysMsg);
    }

    res.status(200).json({ disappearMinutes: conv.disappearMinutes ?? 0 });
  } catch (error) {
    next(error);
  }
};

// scheduled messages

export const scheduleMessage: RequestHandler = async (req, res, next) => {
  try {
    const senderId = req.user!._id;
    const { to, conversationId, text, image, file, scheduledAt } = req.body;

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      return void res.status(400).json({ message: "Pick a time in the future" });
    }
    if (!text?.trim() && !image && !file?.data) {
      return void res.status(400).json({ message: "Message cannot be empty" });
    }

    // resolve the target: a group by id, or a DM by recipient id
    let conv;
    let receiverId: string | undefined;
    if (conversationId) {
      conv = await Conversation.findById(conversationId);
      if (!conv) return void res.status(404).json({ message: "Conversation not found" });
      if (!conv.participants.map(String).includes(String(senderId)))
        return void res.status(403).json({ message: "Not a participant" });
    } else if (to) {
      if (await blockedBetween(String(senderId), String(to)))
        return void res.status(403).json({ message: "You can't message this user" });
      conv = await getOrCreateDirect(senderId, String(to));
      receiverId = String(to);
    } else {
      return void res.status(400).json({ message: "A recipient is required" });
    }

    // upload media up-front so heavy base64 isn't parked in the DB until send
    let imageUrl: string | undefined;
    if (image) imageUrl = (await cloudinary.uploader.upload(image)).secure_url;
    let fileDoc;
    if (file?.data) {
      const up = await cloudinary.uploader.upload(file.data, { resource_type: "auto" });
      fileDoc = { url: up.secure_url, name: file.name || "file", size: file.size || 0, type: file.type || "" };
    }

    const scheduled = await new ScheduledMessage({
      senderId,
      conversationId: conv._id,
      receiverId,
      text: text?.trim(),
      image: imageUrl,
      file: fileDoc,
      scheduledAt: when,
    }).save();

    res.status(201).json(scheduled);
  } catch (error) {
    next(error);
  }
};

export const getScheduledMessages: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const items = await ScheduledMessage.find({ senderId: myId, status: "pending" })
      .sort({ scheduledAt: 1 })
      .populate("receiverId", "fullName username profilePic")
      .populate("conversationId", "name isGroup")
      .lean();
    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
};

export const cancelScheduledMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { id } = req.params;
    const result = await ScheduledMessage.updateOne(
      { _id: id, senderId: myId, status: "pending" },
      { $set: { status: "canceled" } }
    );
    if (result.matchedCount === 0)
      return void res.status(404).json({ message: "Not found or already sent" });
    res.status(200).json({ canceled: true });
  } catch (error) {
    next(error);
  }
};

// starred messages

export const starMessage: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return void res.status(404).json({ message: "Message not found" });

    const conv = await Conversation.findById(message.conversationId);
    if (!conv || !conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not allowed" });

    const starred = message.starredBy.some((id) => String(id) === myId);
    await Message.updateOne(
      { _id: message._id },
      starred ? { $pull: { starredBy: myId } } : { $addToSet: { starredBy: myId } }
    );
    res.status(200).json({ starred: !starred });
  } catch (error) {
    next(error);
  }
};

export const getStarred: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const messages = await Message.find({ starredBy: myId, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("replyTo", "text senderId image deletedAt")
      .lean();
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

// group management

// update group name / description / photo / posting permission (admins only)
export const renameGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const { name, description, avatar, onlyAdminsCanMessage } = req.body;

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) return void res.status(400).json({ message: "Name can't be empty" });
      if (
        !conv.isAnnouncement &&
        cleanName.toLowerCase() !== (conv.name || "").toLowerCase() &&
        (await groupNameTaken(cleanName, { communityId: conv.communityId ?? null, excludeId: conv._id }))
      ) {
        return void res.status(409).json({
          message: conv.communityId
            ? "A group with that name already exists in this community"
            : "A group with that name already exists",
        });
      }
      conv.name = cleanName;
      if (!conv.isAnnouncement) {
        conv.nameKey = conv.communityId
          ? `c:${conv.communityId}:${cleanName.toLowerCase()}`
          : `g:${cleanName.toLowerCase()}`;
      }
    }
    if (description !== undefined) conv.description = String(description).slice(0, 500);
    if (onlyAdminsCanMessage !== undefined) conv.onlyAdminsCanMessage = Boolean(onlyAdminsCanMessage);
    if (avatar) conv.avatar = (await cloudinary.uploader.upload(avatar)).secure_url;

    await conv.save();
    await emitConversationUpdated(conv._id);
    res.status(200).json(conv);
  } catch (error) {
    next(error);
  }
};

// promote/demote a member to admin (admins only)
export const setGroupAdmin: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const { userId, makeAdmin } = req.body;

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });
    if (!conv.participants.map(String).includes(String(userId)))
      return void res.status(400).json({ message: "Not a member" });

    if (makeAdmin) {
      if (!conv.admins.map(String).includes(String(userId)))
        conv.admins.push(userId as unknown as Types.ObjectId);
    } else {
      if (conv.admins.length <= 1)
        return void res.status(400).json({ message: "A group needs at least one admin" });
      conv.admins = conv.admins.filter((a) => String(a) !== String(userId));
    }
    await conv.save();
    await emitConversationUpdated(conv._id);
    res.status(200).json(conv);
  } catch (error) {
    next(error);
  }
};

// invite links

const genInviteCode = () => crypto.randomBytes(6).toString("base64url"); // ~8 url-safe chars

export const createInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });

    // create the code, or rotate it when ?rotate=1 (invalidates the old link)
    if (!conv.inviteCode || req.query.rotate) {
      conv.inviteCode = genInviteCode();
      await conv.save();
    }
    res.status(200).json({ inviteCode: conv.inviteCode });
  } catch (error) {
    next(error);
  }
};

export const revokeInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });

    conv.inviteCode = undefined;
    await conv.save();
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// preview a group from an invite code (before joining)
export const getInvitePreview: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { code } = req.params;
    const conv = await Conversation.findOne({ inviteCode: code, isGroup: true })
      .select("name avatar description participants")
      .lean();
    if (!conv) return void res.status(404).json({ message: "Invalid or expired invite" });
    res.status(200).json({
      _id: conv._id,
      name: conv.name,
      avatar: conv.avatar,
      description: conv.description,
      memberCount: conv.participants.length,
      isMember: conv.participants.map(String).includes(myId),
    });
  } catch (error) {
    next(error);
  }
};

export const joinByInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { code } = req.params;
    const conv = await Conversation.findOne({ inviteCode: code, isGroup: true });
    if (!conv) return void res.status(404).json({ message: "Invalid or expired invite" });

    const already = conv.participants.map(String).includes(String(myId));
    if (!already) {
      if (conv.participants.length >= MAX_GROUP_MEMBERS)
        return void res.status(403).json({ message: "This group is full" });
      conv.participants.push(myId);
      await conv.save();
    }
    const populated = await Conversation.findById(conv._id).populate("participants", "-password");
    if (!already && populated) {
      io.to(userRoom(String(myId))).emit("conversationCreated", populated);
      for (const p of populated.participants) {
        const pid = String((p as { _id?: unknown })._id ?? p);
        if (pid !== String(myId)) io.to(userRoom(pid)).emit("conversationUpdated", populated);
      }
    }
    res.status(200).json(populated);
  } catch (error) {
    next(error);
  }
};

export const addGroupMembers: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const { members } = req.body;
    if (!Array.isArray(members) || members.length === 0)
      return void res.status(400).json({ message: "Members are required" });

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });

    const existing = conv.participants.map(String);
    const added: string[] = [];
    for (const m of members) {
      if (!existing.includes(String(m))) {
        if (conv.participants.length >= MAX_GROUP_MEMBERS) break; // honour the cap
        conv.participants.push(m as unknown as Types.ObjectId);
        added.push(String(m));
      }
    }
    if (added.length === 0)
      return void res.status(400).json({ message: `Group is full (max ${MAX_GROUP_MEMBERS} members)` });
    await conv.save();

    const populated = await Conversation.findById(conv._id).populate("participants", "-password");
    for (const m of added) io.to(userRoom(m)).emit("conversationCreated", populated!);
    await emitConversationUpdated(conv._id);
    res.status(200).json(populated);
  } catch (error) {
    next(error);
  }
};

export const removeGroupMember: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId, userId } = req.params;

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });

    await Conversation.updateOne(
      { _id: conv._id },
      { $pull: { participants: userId, admins: userId } }
    );
    io.to(userRoom(String(userId))).emit("conversationUpdated", conv); // removed user's UI
    await emitConversationUpdated(conv._id);
    res.status(200).json({ removed: true });
  } catch (error) {
    next(error);
  }
};

export const leaveGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.participants.map(String).includes(myId))
      return void res.status(403).json({ message: "Not a participant" });

    await Conversation.updateOne(
      { _id: conv._id },
      { $pull: { participants: myId, admins: myId } }
    );
    await emitConversationUpdated(conv._id);
    res.status(200).json({ left: true });
  } catch (error) {
    next(error);
  }
};
