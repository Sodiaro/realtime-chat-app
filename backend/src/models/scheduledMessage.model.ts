import mongoose, { Schema, Types } from "mongoose";
import type { IFile } from "./message.model.js";

export interface IScheduledMessage {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  conversationId: Types.ObjectId;
  receiverId?: Types.ObjectId; // present for DMs, absent for groups
  text?: string;
  image?: string; // already-uploaded cloudinary url
  file?: IFile;
  scheduledAt: Date;
  status: "pending" | "sent" | "canceled";
  sentMessageId?: Types.ObjectId; // the real message once dispatched
  createdAt: Date;
  updatedAt: Date;
}

const scheduledMessageSchema = new Schema<IScheduledMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User" },
    text: { type: String },
    image: { type: String },
    file: { url: String, name: String, size: Number, type: String },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ["pending", "sent", "canceled"], default: "pending" },
    sentMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

// the poller scans for due, still-pending rows
scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });

const ScheduledMessage = mongoose.model<IScheduledMessage>(
  "ScheduledMessage",
  scheduledMessageSchema
);
export default ScheduledMessage;
