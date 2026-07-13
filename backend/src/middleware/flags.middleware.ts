import type { RequestHandler } from "express";
import { flagsFor } from "../lib/flags.js";

export const withFlags: RequestHandler = (req, _res, next) => {
  req.flags = flagsFor(req.user ? String(req.user._id) : undefined);
  next();
};
