import mongoose, { Schema, Types } from "mongoose";

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  password: string;
  profilePic: string;
  lastSeen?: Date;
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
    lastSeen: {
      type: Date,
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
