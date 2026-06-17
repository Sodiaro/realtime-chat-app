import type { RequestHandler } from "express";
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

const messagePreview = (m: { text?: string; image?: string; audio?: string; file?: unknown; poll?: unknown }) =>
  m.text ||
  (m.image ? "📷 Photo" : m.audio ? "🎤 Voice note" : m.file ? "📎 File" : m.poll ? "📊 Poll" : "New message");

// build a poll subdocument from a {question, options[], multiple} payload
function buildPoll(poll: { question?: string; options?: string[]; multiple?: boolean } | undefined) {
  if (!poll?.question || !Array.isArray(poll.options) || poll.options.length < 2) return undefined;
  return {
    question: String(poll.question).trim(),
    options: poll.options.slice(0, 10).map((t) => ({ text: String(t).trim(), votes: [] })),
    multiple: Boolean(poll.multiple),
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

// only people the user has actually talked to (their DM contacts)
export const getUsersForSidebar: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const convs = await Conversation.find({ isGroup: false, participants: myId })
      .populate("participants", "fullName username profilePic bio status lastSeen")
      .lean();

    const seen = new Set<string>();
    const contacts: unknown[] = [];
    for (const c of convs) {
      const peer = (c.participants as { _id: Types.ObjectId }[]).find(
        (p) => String(p._id) !== myId
      );
      if (peer && !seen.has(String(peer._id))) {
        seen.add(String(peer._id));
        contacts.push(peer);
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
      .select("fullName username profilePic bio status lastSeen")
      .limit(20)
      .lean();
    res.status(200).json(users);
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

    const messages = page.reverse();
    const nextCursor = page.length === limit ? messages[0]?.createdAt : null;

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
    const { text, image, audio, file, poll, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user!._id;

    const pollDoc = buildPoll(poll);
    if (!text && !image && !audio && !file && !pollDoc) {
      res.status(400).json({ message: "Message cannot be empty" });
      return;
    }

    if (await blockedBetween(String(senderId), String(receiverId))) {
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
    const deliveredAt = online.includes(String(receiverId)) ? new Date() : undefined;

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      file: fileDoc,
      poll: pollDoc,
      mentions: await resolveMentions(text, conversation.participants),
      deliveredAt,
      expiresAt: computeExpiry(conversation.disappearMinutes),
      replyTo: replyTo || undefined,
    });

    await newMessage.save();
    await newMessage.populate("replyTo", "text senderId image deletedAt");
    messagesSentTotal.inc();
    applyLinkPreview(newMessage); // fire-and-forget unfurl

    // bump conversation metadata + the receiver's unread count
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: { lastMessage: newMessage._id, lastMessageAt: newMessage.createdAt },
        $inc: { [`unread.${String(receiverId)}`]: 1 },
      }
    );

    // room delivery reaches all of the receiver's devices, on any node
    io.to(userRoom(String(receiverId))).emit("newMessage", newMessage);

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
        body: messagePreview({ text, image: imageUrl, audio: audioUrl }),
      }).catch(() => {});
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
    message.editedAt = new Date();
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

export const forwardMessage: RequestHandler = async (req, res, next) => {
  try {
    const senderId = req.user!._id;
    const myId = String(senderId);
    const { messageId } = req.params;
    const { to } = req.body;

    if (!to || typeof to !== "string") {
      res.status(400).json({ message: "Recipient is required" });
      return;
    }

    const original = await Message.findById(messageId);
    if (!original) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (original.deletedAt) {
      res.status(400).json({ message: "Cannot forward a deleted message" });
      return;
    }
    if (String(original.senderId) !== myId && String(original.receiverId) !== myId) {
      res.status(403).json({ message: "Not a participant of this message" });
      return;
    }
    if (await blockedBetween(myId, to)) {
      res.status(403).json({ message: "You can't message this user" });
      return;
    }

    const conversation = await getOrCreateDirect(senderId, to);
    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId: to,
      text: original.text,
      image: original.image,
      forwardedFrom: original.senderId,
    });
    await newMessage.save();
    messagesSentTotal.inc();

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: { lastMessage: newMessage._id, lastMessageAt: newMessage.createdAt },
        $inc: { [`unread.${to}`]: 1 },
      }
    );

    io.to(userRoom(to)).emit("newMessage", newMessage);
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

// ---- group chats ----

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

    const participants = Array.from(new Set([String(myId), ...members.map(String)]));
    const conversation = new Conversation({
      key: `group:${new mongoose.Types.ObjectId().toString()}`,
      participants,
      isGroup: true,
      name: String(name).trim(),
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

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const query: Record<string, unknown> = { conversationId, ...notExpired() };
    if (req.query.cursor) query.createdAt = { $lt: new Date(String(req.query.cursor)) };

    const page = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("replyTo", "text senderId image deletedAt")
      .lean();

    const messages = page.reverse();
    const nextCursor = page.length === limit ? messages[0]?.createdAt : null;

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
    const { text, image, audio, file, poll, replyTo } = req.body;

    const pollDoc = buildPoll(poll);
    if (!text && !image && !audio && !file && !pollDoc) {
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
      mentions: await resolveMentions(text, conversation.participants),
      expiresAt: computeExpiry(conversation.disappearMinutes),
      replyTo: replyTo || undefined,
    });
    await newMessage.save();
    await newMessage.populate("replyTo", "text senderId image deletedAt");
    messagesSentTotal.inc();
    applyLinkPreview(newMessage); // fire-and-forget unfurl

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
        body: messagePreview({ text, image: imageUrl, audio: audioUrl }),
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

// ---- mute / archive (per user) ----

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

    conv.disappearMinutes = minutes > 0 ? minutes : undefined;
    await conv.save();
    await emitConversationUpdated(conv._id);
    res.status(200).json({ disappearMinutes: conv.disappearMinutes ?? 0 });
  } catch (error) {
    next(error);
  }
};

// ---- scheduled messages ----

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

// ---- starred messages ----

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

// ---- group management ----

export const renameGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { conversationId } = req.params;
    const { name } = req.body;
    if (!name || !String(name).trim())
      return void res.status(400).json({ message: "Name is required" });

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) return void res.status(404).json({ message: "Group not found" });
    if (!conv.admins.map(String).includes(myId))
      return void res.status(403).json({ message: "Admins only" });

    conv.name = String(name).trim();
    await conv.save();
    await emitConversationUpdated(conv._id);
    res.status(200).json(conv);
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
        conv.participants.push(m as unknown as Types.ObjectId);
        added.push(String(m));
      }
    }
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
