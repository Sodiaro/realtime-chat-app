import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import User from "../models/user.model.js";

export const protectRoute: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      res.status(401).json({ message: "Unauthorized - No Token Provided" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
    };

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized - Invalid Token" });
  }
};
