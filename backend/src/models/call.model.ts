import mongoose, { Schema, Types } from "mongoose";

export interface ICall {
  _id: Types.ObjectId;
  callerId: Types.ObjectId;
  calleeId: Types.ObjectId;
  type: "audio" | "video";
  status: "answered" | "missed" | "rejected";
  durationSec: number;
  createdAt: Date;
  updatedAt: Date;
}

const callSchema = new Schema<ICall>(
  {
    callerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    calleeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["audio", "video"], required: true },
    status: { type: String, enum: ["answered", "missed", "rejected"], default: "missed" },
    durationSec: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Call = mongoose.model<ICall>("Call", callSchema);
export default Call;
