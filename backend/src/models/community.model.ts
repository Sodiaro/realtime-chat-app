import mongoose, { Schema, Types } from "mongoose";

// A Community groups several conversations together (an org / school / team).
// Members join the community (and its announcement channel) and may then join
// individual groups à la carte — they don't have to belong to every group.
// Groups link back via Conversation.communityId; the announcement channel is a
// normal group conversation flagged isAnnouncement + onlyAdminsCanMessage.
// Per-workspace Dev Mode override (Phase 1). Identical three-state shape to
// Conversation.IWorkspaceDevMode (absent ⇒ inherit / true ⇒ dev / false ⇒ chat).
// Defined locally to keep models self-contained (matching the repo convention);
// keep in sync with conversation.model.ts.
export interface IWorkspaceDevMode {
  enabled: boolean;
  enabledBy?: Types.ObjectId; // who last toggled it (audit trail)
  enabledAt?: Date;
}

export interface ICommunity {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  admins: Types.ObjectId[];
  moderators: Types.ObjectId[]; // can create/edit groups, but not manage roles
  members: Types.ObjectId[];
  banned: Types.ObjectId[]; // removed + barred from rejoining
  announcementId: Types.ObjectId; // the announcement channel conversation
  inviteCode?: string; // join-by-link code (absent = link disabled)
  nameKey?: string; // lowercased name for case-insensitive uniqueness
  devMode?: IWorkspaceDevMode; // absent ⇒ inherit (see IWorkspaceDevMode)
  createdAt: Date;
  updatedAt: Date;
}

// Single embedded subdoc; paired with `default: undefined` on the path so Mongoose
// never auto-creates it — absent until the community is explicitly toggled.
const workspaceDevModeSchema = new Schema<IWorkspaceDevMode>(
  {
    enabled: { type: Boolean, default: false },
    enabledBy: { type: Schema.Types.ObjectId, ref: "User" },
    enabledAt: { type: Date },
  },
  { _id: false }
);

const communitySchema = new Schema<ICommunity>(
  {
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderators: [{ type: Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    banned: [{ type: Schema.Types.ObjectId, ref: "User" }],
    announcementId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    inviteCode: { type: String, unique: true, sparse: true },
    nameKey: { type: String },
    // default: undefined ⇒ absent unless explicitly set (three-state + backward compat).
    devMode: { type: workspaceDevModeSchema, default: undefined },
  },
  { timestamps: true }
);

communitySchema.index({ members: 1, updatedAt: -1 });
// case-insensitive unique community names (sparse → legacy docs skipped)
communitySchema.index({ nameKey: 1 }, { unique: true, sparse: true });

const Community = mongoose.model<ICommunity>("Community", communitySchema);
export default Community;
