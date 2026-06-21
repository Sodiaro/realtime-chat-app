import type { RequestHandler } from "express";
import Status from "../models/status.model.js";
import Conversation from "../models/conversation.model.js";
import cloudinary from "../lib/cloudinary.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const createStatus: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!._id;
    const { type, text, image, bgColor } = req.body;
    if (type !== "text" && type !== "image") {
      res.status(400).json({ message: "Invalid status type" });
      return;
    }
    if (type === "text" && !text?.trim()) {
      res.status(400).json({ message: "Text is required" });
      return;
    }

    let imageUrl: string | undefined;
    if (type === "image") {
      if (!image) {
        res.status(400).json({ message: "Image is required" });
        return;
      }
      imageUrl = (await cloudinary.uploader.upload(image)).secure_url;
    }

    const status = await new Status({
      userId,
      type,
      text: text?.trim(),
      image: imageUrl,
      bgColor,
      expiresAt: new Date(Date.now() + DAY_MS),
    }).save();

    res.status(201).json(status);
  } catch (error) {
    next(error);
  }
};

// statuses from me + my DM contacts, grouped by user
export const getStatuses: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const convs = await Conversation.find({ isGroup: false, participants: myId })
      .select("participants")
      .lean();
    const ids = new Set<string>([myId]);
    convs.forEach((c) => c.participants.forEach((p) => ids.add(String(p))));

    const statuses = await Status.find({ userId: { $in: [...ids] } })
      .sort({ createdAt: 1 })
      .populate("userId", "fullName username profilePic")
      .populate("views.user", "fullName username profilePic")
      .lean();

    const groups: Record<string, { user: unknown; statuses: unknown[]; hasUnviewed: boolean }> = {};
    for (const s of statuses) {
      const u = s.userId as { _id: unknown };
      const uid = String(u._id);
      const owned = uid === myId;
      const iViewed = s.views?.some((v) => String((v.user as { _id?: unknown })?._id ?? v.user) === myId);
      // viewer details (name/pic/time) are private to the status owner
      if (!owned) (s as { views?: unknown[] }).views = [];
      groups[uid] ??= { user: s.userId, statuses: [], hasUnviewed: false };
      groups[uid]!.statuses.push(s);
      if (!owned && !iViewed) groups[uid]!.hasUnviewed = true;
    }

    // me first, then others
    const result = Object.entries(groups)
      .sort(([a], [b]) => (a === myId ? -1 : b === myId ? 1 : 0))
      .map(([, g]) => g);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const viewStatus: RequestHandler = async (req, res, next) => {
  try {
    const me = req.user!._id;
    // ghost mode: view privately — never record the view
    if (!req.user!.ghostMode) {
      // record a view once per viewer; don't count the owner viewing their own
      await Status.updateOne(
        { _id: req.params.id, userId: { $ne: me }, "views.user": { $ne: me } },
        { $push: { views: { user: me, viewedAt: new Date() } } }
      );
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const deleteStatus: RequestHandler = async (req, res, next) => {
  try {
    await Status.deleteOne({ _id: req.params.id, userId: req.user!._id });
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};
