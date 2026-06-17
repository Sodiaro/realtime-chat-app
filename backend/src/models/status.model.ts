import mongoose, { Schema, Types } from "mongoose";

export interface IStatusView {
  user: Types.ObjectId;
  viewedAt: Date;
}

export interface IStatus {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: "text" | "image";
  text?: string;
  image?: string;
  bgColor?: string;
  views: IStatusView[];
  expiresAt: Date; // TTL — auto-removed after 24h
  createdAt: Date;
}

const statusSchema = new Schema<IStatus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["text", "image"], required: true },
    text: { type: String },
    image: { type: String },
    bgColor: { type: String },
    views: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Status = mongoose.model<IStatus>("Status", statusSchema);
export default Status;
