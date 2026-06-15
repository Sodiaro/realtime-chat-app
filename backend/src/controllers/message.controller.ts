import type { RequestHandler } from "express";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation, { getOrCreateDirect } from "../models/conversation.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userRoom } from "../lib/socket.js";

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

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};
