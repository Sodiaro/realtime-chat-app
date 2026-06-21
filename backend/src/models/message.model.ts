import mongoose, { Schema, Types } from "mongoose";

export interface IReaction {
  userId: Types.ObjectId;
  emoji: string;
}

export interface IFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface ILinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface IPollOption {
  text: string;
  votes: Types.ObjectId[];
}

export interface IPoll {
  question: string;
  options: IPollOption[];
  multiple: boolean;
}

export interface ILocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface IContactCard {
  userId?: Types.ObjectId;
  name: string;
  username?: string;
  avatar?: string;
}

export interface ICallEvent {
  type: "audio" | "video";
  status: "answered" | "missed" | "rejected";
  durationSec?: number;
}

// in-timeline system notice (e.g. disappearing messages turned on/off)
export interface ISystemEvent {
  type: "disappearing";
  on: boolean;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId?: Types.ObjectId; // absent for group messages
  text?: string;
  image?: string;
  audio?: string;
  file?: IFile;
  linkPreview?: ILinkPreview;
  poll?: IPoll;
  location?: ILocation;
  contact?: IContactCard;
  call?: ICallEvent;
  system?: ISystemEvent;
  mentions: Types.ObjectId[];
  deliveredAt?: Date;
  readAt?: Date;
  readBy: Types.ObjectId[]; // group read receipts: who has read this message
  editedAt?: Date;
  deletedAt?: Date;
  pinnedAt?: Date;
  replyTo?: Types.ObjectId;
  forwardedFrom?: Types.ObjectId;
  reactions: IReaction[];
  starredBy: Types.ObjectId[];
  expiresAt?: Date; // disappearing messages
  viewOnce?: boolean; // content can be opened only once per recipient
  viewedBy: Types.ObjectId[]; // recipients who have consumed a view-once message
  ghostDeleted?: boolean; // deleted by a ghost-mode user → hide silently (no tombstone)
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFile>(
  { url: String, name: String, size: Number, type: String },
  { _id: false }
);
const linkPreviewSchema = new Schema<ILinkPreview>(
  { url: String, title: String, description: String, image: String },
  { _id: false }
);
const pollSchema = new Schema<IPoll>(
  {
    question: String,
    options: [{ text: String, votes: [{ type: Schema.Types.ObjectId, ref: "User" }] }],
    multiple: Boolean,
  },
  { _id: false }
);
const locationSchema = new Schema<ILocation>(
  { lat: Number, lng: Number, label: String },
  { _id: false }
);
const contactSchema = new Schema<IContactCard>(
  { userId: { type: Schema.Types.ObjectId, ref: "User" }, name: String, username: String, avatar: String },
  { _id: false }
);
const callSchema = new Schema<ICallEvent>(
  { type: String, status: String, durationSec: Number },
  { _id: false }
);
const systemSchema = new Schema<ISystemEvent>(
  { type: String, on: Boolean },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    audio: {
      type: String,
    },
    file: fileSchema,
    linkPreview: linkPreviewSchema,
    poll: pollSchema,
    location: locationSchema,
    contact: contactSchema,
    call: callSchema,
    system: systemSchema,
    mentions: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    editedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
    pinnedAt: {
      type: Date,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    forwardedFrom: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reactions: {
      type: [{ userId: { type: Schema.Types.ObjectId, ref: "User" }, emoji: String }],
      default: [],
    },
    starredBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    expiresAt: { type: Date },
    viewOnce: { type: Boolean, default: false },
    viewedBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    ghostDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
// TTL: Mongo auto-deletes expired (disappearing) messages
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model<IMessage>("Message", messageSchema);
export default Message;
