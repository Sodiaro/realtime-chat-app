import type { RequestHandler } from "express";
import Call from "../models/call.model.js";

export const logCall: RequestHandler = async (req, res, next) => {
  try {
    const callerId = req.user!._id;
    const { calleeId, type, status, durationSec } = req.body;
    if (!calleeId || (type !== "audio" && type !== "video")) {
      res.status(400).json({ message: "Invalid call" });
      return;
    }
    const call = await new Call({
      callerId,
      calleeId,
      type,
      status: ["answered", "missed", "rejected"].includes(status) ? status : "missed",
      durationSec: Number(durationSec) || 0,
    }).save();
    res.status(201).json(call);
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
