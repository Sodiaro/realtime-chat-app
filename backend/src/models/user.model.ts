import mongoose, { Schema, Types } from "mongoose";

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  password: string;
  profilePic: string;
  username?: string;
  bio?: string;
  status?: string;
  lastSeen?: Date;
  blockedUsers: Types.ObjectId[];
  isAdmin: boolean;
  tokenVersion: number; // bump to invalidate all existing JWTs
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // allow many users without a username
    },
    bio: {
      type: String,
      maxlength: 200,
    },
    status: {
      type: String,
      maxlength: 80,
    },
    lastSeen: {
      type: Date,
    },
    blockedUsers: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
