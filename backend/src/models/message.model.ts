import mongoose, { Schema, Types } from "mongoose";

export interface IReaction {
  userId: Types.ObjectId;
  emoji: string;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId?: Types.ObjectId; // absent for group messages
  text?: string;
  image?: string;
  audio?: string;
  mentions: Types.ObjectId[];
  readAt?: Date;
  editedAt?: Date;
  deletedAt?: Date;
  pinnedAt?: Date;
  replyTo?: Types.ObjectId;
  forwardedFrom?: Types.ObjectId;
  reactions: IReaction[];
  createdAt: Date;
  updatedAt: Date;
}

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
    mentions: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    readAt: {
      type: Date,
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
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model<IMessage>("Message", messageSchema);
export default Message;
