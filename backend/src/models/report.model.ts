import mongoose, { Schema, Types } from "mongoose";

export interface IReport {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  messageId: Types.ObjectId;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
  },
  { timestamps: true }
);

const Report = mongoose.model<IReport>("Report", reportSchema);
export default Report;
