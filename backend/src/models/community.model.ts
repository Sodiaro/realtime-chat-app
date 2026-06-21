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
  members: Types.ObjectId[];
  announcementId: Types.ObjectId; // the announcement channel conversation
  createdAt: Date;
  updatedAt: Date;
}

const communitySchema = new Schema<ICommunity>(
  {
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    announcementId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  },
  { timestamps: true }
);

communitySchema.index({ members: 1, updatedAt: -1 });

const Community = mongoose.model<ICommunity>("Community", communitySchema);
export default Community;
