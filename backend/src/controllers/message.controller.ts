import type { RequestHandler } from "express";
import mongoose, { type Types } from "mongoose";
import User from "../models/user.model.js";
import Message, { type IMessage } from "../models/message.model.js";
import Conversation, { getOrCreateDirect } from "../models/conversation.model.js";
import Report from "../models/report.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userRoom } from "../lib/socket.js";
import { enqueueNewMessageNotification } from "../lib/queues.js";
import { messagesSentTotal } from "../lib/metrics.js";

export const getUsersForSidebar: RequestHandler = async (req, res, next) => {
  try {
    const loggedInUserId = req.user!._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-password")
      .limit(100)
      .lean();

    res.status(200).json(filteredUsers);
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
      .populate("participants", "-password");

    const result = conversations.map((c) => ({
      _id: c._id,
      participants: c.participants,
      isGroup: c.isGroup,
      name: c.name,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unread: c.unread?.get(myId) ?? 0,
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
    const query: Record<string, unknown> = { conversationId: conversation._id };
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
    const { text, image, audio, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user!._id;

    if (!text && !image && !audio) {
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
      const uploadResponse = await cloudinary.uploader.upload(audio, { resource_type: "video" });
      audioUrl = uploadResponse.secure_url;
    }

    const conversation = await getOrCreateDirect(senderId, String(receiverId));

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      mentions: await resolveMentions(text, conversation.participants),
      replyTo: replyTo || undefined,
    });

    await newMessage.save();
    await newMessage.populate("replyTo", "text senderId image deletedAt");
    messagesSentTotal.inc();

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

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

// push a message update to both participants (all their devices, any node)
function emitToParticipants(
  senderId: unknown,
  receiverId: unknown,
  message: IMessage
) {
  io.to(userRoom(String(senderId))).emit("messageUpdated", message);
  io.to(userRoom(String(receiverId))).emit("messageUpdated", message);
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

    message.text = String(text).trim();
    message.editedAt = new Date();
    await message.save();

    emitToParticipants(message.senderId, message.receiverId, message);
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

    // soft delete: keep the row so history stays consistent
    message.deletedAt = new Date();
    message.text = undefined;
    message.image = undefined;
    message.reactions = [];
    await message.save();

    emitToParticipants(message.senderId, message.receiverId, message);
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

    emitToParticipants(message.senderId, message.receiverId, message);
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

    emitToParticipants(message.senderId, message.receiverId, message);
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
    const query: Record<string, unknown> = { conversationId };
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
    const { text, image, audio, replyTo } = req.body;

    if (!text && !image && !audio) {
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
    if (audio) audioUrl = (await cloudinary.uploader.upload(audio, { resource_type: "video" })).secure_url;

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      text,
      image: imageUrl,
      audio: audioUrl,
      mentions: await resolveMentions(text, conversation.participants),
      replyTo: replyTo || undefined,
    });
    await newMessage.save();
    await newMessage.populate("replyTo", "text senderId image deletedAt");
    messagesSentTotal.inc();

    const unreadInc: Record<string, number> = {};
    for (const p of participants) if (p !== String(senderId)) unreadInc[`unread.${p}`] = 1;
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { lastMessage: newMessage._id, lastMessageAt: newMessage.createdAt }, $inc: unreadInc }
    );

    for (const p of participants) {
      if (p !== String(senderId)) io.to(userRoom(p)).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};
