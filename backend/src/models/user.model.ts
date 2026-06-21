import mongoose, { Schema, Types } from "mongoose";

export type Visibility = "everyone" | "contacts" | "nobody";

export interface IPrivacy {
  lastSeen: Visibility;
  readReceipts: boolean;
  profilePhoto: Visibility;
}

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
  isVerified: boolean;
  emailOtp?: string; // hashed OTP
  emailOtpExpires?: Date;
  emailOtpAttempts: number; // failed verification attempts (brute-force guard)
  resetOtp?: string; // hashed password-reset code
  resetOtpExpires?: Date;
  resetOtpAttempts: number;
  privacy: IPrivacy;
  ghostMode: boolean; // suppresses read/edit/delete/last-seen/status-view activity (publicly flagged)
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
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailOtp: { type: String },
    emailOtpExpires: { type: Date },
    emailOtpAttempts: { type: Number, default: 0 },
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },
    resetOtpAttempts: { type: Number, default: 0 },
    privacy: {
      lastSeen: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      readReceipts: { type: Boolean, default: true },
      profilePhoto: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
    },
    ghostMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
