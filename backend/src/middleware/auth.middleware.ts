import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import User from "../models/user.model.js";
import Session from "../models/session.model.js";

export const protectRoute: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      res.status(401).json({ message: "Unauthorized - No Token Provided" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
      tokenVersion?: number;
      sid?: string;
    };

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // a bumped tokenVersion invalidates older tokens (logout-all / password change)
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      res.status(401).json({ message: "Session expired, please log in again" });
      return;
    }

    // tokens issued with a device session must still have that session (revocable
    // per-device). Older tokens without a sid stay valid for backward compatibility.
    if (decoded.sid) {
      const session = await Session.findById(decoded.sid).select("_id");
      if (!session) {
        res.status(401).json({ message: "This device was logged out" });
        return;
      }
      req.sessionId = decoded.sid;
      Session.updateOne({ _id: decoded.sid }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized - Invalid Token" });
  }
};
