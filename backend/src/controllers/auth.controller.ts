import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import cloudinary from "../lib/cloudinary.js";

export const signup: RequestHandler = async (req, res, next) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const user = await User.findOne({ email });

    if (user) {
      res.status(400).json({ message: "Email already exists" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    generateToken(newUser._id, res, newUser.tokenVersion);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    generateToken(user._id, res, user.tokenVersion);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
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
