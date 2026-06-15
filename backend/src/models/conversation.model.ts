import mongoose, { Schema, Types } from "mongoose";

export interface IConversation {
  _id: Types.ObjectId;
  key: string; // sorted participant ids — dedups 1:1 conversations
  participants: Types.ObjectId[];
  isGroup: boolean;
  name?: string; // group name
  admins: Types.ObjectId[]; // group admins (creator by default)
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  unread: Map<string, number>; // userId -> unread count
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    key: { type: String, required: true, unique: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    isGroup: { type: Boolean, default: false },
    name: { type: String },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);

// deterministic key so the same two users always map to one conversation
export function directKey(a: string, b: string): string {
  return [a, b].sort().join("_");
}

// find-or-create the 1:1 conversation for two users (atomic upsert, no dupes)
export async function getOrCreateDirect(
  aId: Types.ObjectId | string,
  bId: Types.ObjectId | string
) {
  const a = String(aId);
  const b = String(bId);
  const key = directKey(a, b);
  const participants = [a, b].sort();
  const conv = await Conversation.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, participants, isGroup: false } },
    { upsert: true, new: true }
  );
  return conv!;
}

export default Conversation;
