import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { Types } from "mongoose";

export const generateToken = (
  userId: Types.ObjectId | string,
  res: Response,
  tokenVersion = 0,
  sid?: string // device session id (so individual devices can be revoked)
) => {
  const token = jwt.sign(
    { userId, tokenVersion, ...(sid ? { sid } : {}) },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
    httpOnly: true, // prevent XSS attacks cross-site scripting attacks
    sameSite: "strict", // CSRF attacks cross-site request forgery attacks
    secure: process.env.NODE_ENV === "production",
  });

  return token;
};
