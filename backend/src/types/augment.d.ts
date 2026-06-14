import type { IUser } from "../models/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

declare module "socket.io" {
  interface Socket {
    userId?: string;
  }
}

export {};
