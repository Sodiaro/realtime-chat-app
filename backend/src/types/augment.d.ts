import type { IUser } from "../models/user.model.js";
import type { FlagSnapshot } from "../lib/flags.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      sessionId?: string; // the device session this request's token belongs to
      flags?: FlagSnapshot; // resolved feature-flag snapshot (set by withFlags)
    }
  }
}

declare module "socket.io" {
  interface Socket {
    userId?: string;
  }
}

export {};
