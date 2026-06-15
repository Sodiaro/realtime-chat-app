import type { RequestHandler } from "express";
import User from "../models/user.model.js";
import Message, { type IMessage } from "../models/message.model.js";
import Conversation, { getOrCreateDirect } from "../models/conversation.model.js";
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

export const sendMessage: RequestHandler = async (req, res, next) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user!._id;

    if (!text && !image) {
      res.status(400).json({ message: "Message cannot be empty" });
      return;
    }

    let imageUrl: string | undefined;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const conversation = await getOrCreateDirect(senderId, String(receiverId));

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();
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
