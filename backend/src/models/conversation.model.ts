import mongoose, { Schema, Types } from "mongoose";

// Per-workspace Dev Mode override (Phase 1). Three-state by design:
//   • absent (undefined) ⇒ inherit the viewer's personal default
//   • { enabled: true }  ⇒ this workspace is explicitly a dev workspace
//   • { enabled: false } ⇒ explicitly forced to Chat Mode (overrides the default)
// (Community.model defines an identical shape — keep the two in sync.)
export interface IWorkspaceDevMode {
  enabled: boolean;
  enabledBy?: Types.ObjectId; // who last toggled it (audit trail)
  enabledAt?: Date;
}

export interface IConversation {
  _id: Types.ObjectId;
  key: string; // sorted participant ids — dedups 1:1 conversations
  participants: Types.ObjectId[];
  isGroup: boolean;
  name?: string; // group name
  avatar?: string; // group photo (cloudinary url)
  description?: string; // group description
  admins: Types.ObjectId[]; // group admins (creator by default)
  inviteCode?: string; // join-by-link code (absent = link disabled)
  onlyAdminsCanMessage?: boolean; // restrict posting to admins
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  unread: Map<string, number>; // userId -> unread count
  mutedBy: Types.ObjectId[];
  archivedBy: Types.ObjectId[];
  pinnedBy: Types.ObjectId[]; // users who pinned this chat to the top
  disappearMinutes?: number; // 0/undefined = off
  communityId?: Types.ObjectId; // group belongs to a community
  isAnnouncement?: boolean; // the community's announcement channel
  // scoped, lowercased uniqueness key for groups: "g:<name>" (standalone) or
  // "c:<communityId>:<name>" (community group). Absent for DMs/announcements.
  nameKey?: string;
  devMode?: IWorkspaceDevMode; // groups only; absent ⇒ inherit (see IWorkspaceDevMode)
  createdAt: Date;
  updatedAt: Date;
}

// `_id: false` (it's a single embedded doc, not a collection row). Paired below with
// `default: undefined` on the path so Mongoose never auto-creates it — the path is
// absent until a group is explicitly toggled.
const workspaceDevModeSchema = new Schema<IWorkspaceDevMode>(
  {
    enabled: { type: Boolean, default: false },
    enabledBy: { type: Schema.Types.ObjectId, ref: "User" },
    enabledAt: { type: Date },
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation>(
  {
    key: { type: String, required: true, unique: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    isGroup: { type: Boolean, default: false },
    name: { type: String },
    avatar: { type: String },
    description: { type: String },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    inviteCode: { type: String, unique: true, sparse: true },
    onlyAdminsCanMessage: { type: Boolean, default: false },
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date },
    unread: { type: Map, of: Number, default: {} },
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    archivedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pinnedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    disappearMinutes: { type: Number },
    communityId: { type: Schema.Types.ObjectId, ref: "Community", index: true },
    isAnnouncement: { type: Boolean, default: false },
    nameKey: { type: String },
    // default: undefined ⇒ absent unless explicitly set (preserves three-state +
    // backward compatibility; no index, no migration).
    devMode: { type: workspaceDevModeSchema, default: undefined },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
// hard guarantee against duplicate group names (race-proof backstop). Sparse so
// only groups that set nameKey participate — DMs, announcements & legacy docs are skipped.
conversationSchema.index({ nameKey: 1 }, { unique: true, sparse: true });

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
