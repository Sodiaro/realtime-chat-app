import type { RequestHandler } from "express";
import Call from "../models/call.model.js";
import Message from "../models/message.model.js";
import Conversation, { getOrCreateDirect } from "../models/conversation.model.js";
import { io, userRoom, getOnlineUserIds } from "../lib/socket.js";
import { sendPush } from "../lib/push.js";

export const logCall: RequestHandler = async (req, res, next) => {
  try {
    const callerId = req.user!._id;
    const { calleeId, type, status, durationSec } = req.body;
    if (!calleeId || (type !== "audio" && type !== "video")) {
      res.status(400).json({ message: "Invalid call" });
      return;
    }
    const callStatus = ["answered", "missed", "rejected"].includes(status) ? status : "missed";
    const seconds = Number(durationSec) || 0;

    const call = await new Call({
      callerId,
      calleeId,
      type,
      status: callStatus,
      durationSec: seconds,
    }).save();

    // also drop a call event into the conversation timeline (visible to both)
    const conv = await getOrCreateDirect(callerId, String(calleeId));
    const message = await new Message({
      conversationId: conv._id,
      senderId: callerId, // the caller — direction is derived from this per viewer
      receiverId: calleeId,
      call: { type, status: callStatus, durationSec: seconds },
    }).save();
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { lastMessage: message._id, lastMessageAt: message.createdAt } }
    );
    io.to(userRoom(String(callerId))).emit("newMessage", message);
    io.to(userRoom(String(calleeId))).emit("newMessage", message);

    res.status(201).json(call);
  } catch (error) {
    next(error);
  }
};

// log a group call into the group's timeline + ring offline members via push
export const logGroupCall: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { conversationId, type } = req.body;
    if (type !== "audio" && type !== "video") {
      res.status(400).json({ message: "Invalid call" });
      return;
    }
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.isGroup) {
      res.status(404).json({ message: "Group not found" });
      return;
    }
    const participants = conv.participants.map(String);
    if (!participants.includes(String(myId))) {
      res.status(403).json({ message: "Not a participant" });
      return;
    }

    const message = await new Message({
      conversationId: conv._id,
      senderId: myId,
      call: { type, status: "answered", group: true },
    }).save();
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { lastMessage: message._id, lastMessageAt: message.createdAt } }
    );
    for (const p of participants) io.to(userRoom(p)).emit("newMessage", message);

    // push to members who aren't currently online (so they can join)
    const online = await getOnlineUserIds();
    const offline = participants.filter((p) => p !== String(myId) && !online.includes(p));
    if (offline.length) {
      sendPush(offline, {
        title: `${req.user!.fullName}${conv.name ? " · " + conv.name : ""}`,
        body: `Started a ${type === "video" ? "video" : "voice"} group call`,
      }).catch(() => {});
    }

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

export const getCalls: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const calls = await Call.find({ $or: [{ callerId: myId }, { calleeId: myId }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("callerId", "fullName username profilePic")
      .populate("calleeId", "fullName username profilePic")
      .lean();
    res.status(200).json(calls);
  } catch (error) {
    next(error);
  }
};
