import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import { env } from "../lib/env.js";
import { sendOtpEmail } from "../lib/email.js";
import User, { type IUser } from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import cloudinary from "../lib/cloudinary.js";

const publicUser = (u: IUser) => ({
  _id: u._id,
  fullName: u.fullName,
  email: u.email,
  username: u.username,
  profilePic: u.profilePic,
  bio: u.bio,
  status: u.status,
  isAdmin: u.isAdmin,
  privacy: u.privacy,
});

const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const signup: RequestHandler = async (req, res, next) => {
  const { fullName, email, password, username } = req.body;
  try {
    if (!fullName || !email || !password || !username) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const handle = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      res.status(400).json({ message: "Username must be 3-20 chars: letters, numbers, underscore" });
      return;
    }
    if (await User.findOne({ email })) {
      res.status(400).json({ message: "Email already exists" });
      return;
    }
    if (await User.findOne({ username: handle })) {
      res.status(409).json({ message: "Username is already taken" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ fullName, email, username: handle, password: hashedPassword });

    // tests skip email verification
    if (env.NODE_ENV === "test") {
      newUser.isVerified = true;
      await newUser.save();
      generateToken(newUser._id, res, newUser.tokenVersion);
      res.status(201).json(publicUser(newUser));
      return;
    }

    // otherwise: send an OTP and require verification before login
    const otp = genOtp();
    newUser.emailOtp = await bcrypt.hash(otp, salt);
    newUser.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await newUser.save();
    await sendOtpEmail(email, otp);

    res.status(201).json({
      needsVerification: true,
      email,
      ...(env.NODE_ENV === "development" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail: RequestHandler = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ message: "Email and code are required" });
      return;
    }
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    if (user.isVerified) {
      generateToken(user._id, res, user.tokenVersion);
      res.status(200).json(publicUser(user));
      return;
    }
    if (!user.emailOtp || !user.emailOtpExpires || user.emailOtpExpires < new Date()) {
      res.status(400).json({ message: "Code expired — please resend" });
      return;
    }
    if (!(await bcrypt.compare(String(otp), user.emailOtp))) {
      res.status(400).json({ message: "Invalid code" });
      return;
    }
    user.isVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();
    generateToken(user._id, res, user.tokenVersion);
    res.status(200).json(publicUser(user));
  } catch (error) {
    next(error);
  }
};

export const resendOtp: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.isVerified) {
      res.status(200).json({ message: "If that account needs verification, a code was sent" });
      return;
    }
    const otp = genOtp();
    const salt = await bcrypt.genSalt(10);
    user.emailOtp = await bcrypt.hash(otp, salt);
    user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtpEmail(email, otp);
    res.status(200).json({
      message: "Code sent",
      ...(env.NODE_ENV === "development" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  const { email, password } = req.body; // "email" carries email OR username
  try {
    const identifier = String(email || "").trim();
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier.toLowerCase() }],
    });

    if (!user) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({
        message: "Please verify your email first",
        needsVerification: true,
        email: user.email,
      });
      return;
    }

    generateToken(user._id, res, user.tokenVersion);
    res.status(200).json(publicUser(user));
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = (req, res, next) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    const { profilePic, username, bio, status } = req.body;
    const userId = req.user!._id;

    const update: Record<string, unknown> = {};

    if (profilePic) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        update.profilePic = uploadResponse.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload failed:", (uploadErr as Error).message);
        res.status(502).json({ message: "Image upload failed. Check the image and try again." });
        return;
      }
    }

    if (username !== undefined) {
      const handle = String(username).trim().toLowerCase();
      if (handle && !/^[a-z0-9_]{3,20}$/.test(handle)) {
        res.status(400).json({ message: "Username must be 3-20 chars: letters, numbers, underscore" });
        return;
      }
      if (handle) {
        const taken = await User.findOne({ username: handle, _id: { $ne: userId } });
        if (taken) {
          res.status(409).json({ message: "Username is already taken" });
          return;
        }
      }
      update.username = handle || undefined;
    }
    if (bio !== undefined) update.bio = String(bio).slice(0, 200);
    if (status !== undefined) update.status = String(status).slice(0, 80);

    if (Object.keys(update).length === 0) {
      res.status(400).json({ message: "Nothing to update" });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true }).select("-password");
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const updatePrivacy: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { lastSeen, readReceipts, profilePhoto } = req.body;
    const options = ["everyone", "contacts", "nobody"];
    const set: Record<string, unknown> = {};

    if (lastSeen !== undefined) {
      if (!options.includes(lastSeen)) return void res.status(400).json({ message: "Invalid lastSeen" });
      set["privacy.lastSeen"] = lastSeen;
    }
    if (profilePhoto !== undefined) {
      if (!options.includes(profilePhoto)) return void res.status(400).json({ message: "Invalid profilePhoto" });
      set["privacy.profilePhoto"] = profilePhoto;
    }
    if (readReceipts !== undefined) set["privacy.readReceipts"] = Boolean(readReceipts);

    if (Object.keys(set).length === 0) {
      return void res.status(400).json({ message: "Nothing to update" });
    }

    const user = await User.findByIdAndUpdate(myId, { $set: set }, { new: true }).select("-password");
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const checkAuth: RequestHandler = (req, res, next) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    next(error);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Both current and new password are required" });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters" });
      return;
    }
    const user = await User.findById(myId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.tokenVersion += 1; // sign out other sessions
    await user.save();
    generateToken(user._id, res, user.tokenVersion); // keep this session valid
    res.status(200).json({ message: "Password changed" });
  } catch (error) {
    next(error);
  }
};

export const logoutAllDevices: RequestHandler = async (req, res, next) => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    user.tokenVersion += 1;
    await user.save();
    generateToken(user._id, res, user.tokenVersion); // re-issue for this device
    res.status(200).json({ message: "Logged out of all other devices" });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    await Message.deleteMany({ $or: [{ senderId: myId }, { receiverId: myId }] });
    await Conversation.deleteMany({ isGroup: false, participants: myId });
    await Conversation.updateMany(
      { isGroup: true, participants: myId },
      { $pull: { participants: myId, admins: myId } }
    );
    await User.findByIdAndDelete(myId);
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Account deleted" });
  } catch (error) {
    next(error);
  }
};

export const checkUsername: RequestHandler = async (req, res, next) => {
  try {
    const handle = String(req.query.username || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      res.status(200).json({ available: false, reason: "invalid" });
      return;
    }
    const taken = await User.findOne({ username: handle });
    res.status(200).json({ available: !taken });
  } catch (error) {
    next(error);
  }
};

export const blockUser: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;

    if (id === myId) {
      res.status(400).json({ message: "You cannot block yourself" });
      return;
    }

    const me = await User.findById(myId);
    if (!me) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const idx = me.blockedUsers.findIndex((u) => String(u) === id);
    if (idx >= 0) me.blockedUsers.splice(idx, 1); // unblock
    else me.blockedUsers.push(id as unknown as (typeof me.blockedUsers)[number]); // block
    await me.save();

    res.status(200).json({ blockedUsers: me.blockedUsers });
  } catch (error) {
    next(error);
  }
};
