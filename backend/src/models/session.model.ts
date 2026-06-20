import mongoose, { Schema, Types } from "mongoose";

export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  userAgent: string;
  ip: string;
  createdAt: Date;
  lastSeenAt: Date;
}

const sessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userAgent: { type: String, default: "" },
  ip: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});

// abandoned sessions self-expire 30 days after their last activity
sessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Session = mongoose.model<ISession>("Session", sessionSchema);
export default Session;
