import type { RequestHandler } from "express";
import { env } from "../lib/env.js";
import PushSubscription from "../models/pushSubscription.model.js";

export const getPublicKey: RequestHandler = (_req, res) => {
  res.status(200).json({ key: env.VAPID_PUBLIC_KEY || null });
};

export const subscribe: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!._id;
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      res.status(400).json({ message: "Invalid subscription" });
      return;
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { userId, endpoint: subscription.endpoint, keys: subscription.keys },
      { upsert: true, new: true }
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const unsubscribe: RequestHandler = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await PushSubscription.deleteOne({ endpoint });
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};
