import mongoose, { Schema, Types } from "mongoose";

// A Community groups several conversations together (an org / school / team).
// Members join the community (and its announcement channel) and may then join
// individual groups à la carte — they don't have to belong to every group.
// Groups link back via Conversation.communityId; the announcement channel is a
// normal group conversation flagged isAnnouncement + onlyAdminsCanMessage.
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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

communitySchema.index({ members: 1, updatedAt: -1 });
// case-insensitive unique community names (sparse → legacy docs skipped)
communitySchema.index({ nameKey: 1 }, { unique: true, sparse: true });

const Community = mongoose.model<ICommunity>("Community", communitySchema);
export default Community;
