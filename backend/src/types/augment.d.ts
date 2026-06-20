import type { IUser } from "../models/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      sessionId?: string; // the device session this request's token belongs to
    }
  }
}

declare module "socket.io" {
  interface Socket {
    userId?: string;
  }
}

export {};
