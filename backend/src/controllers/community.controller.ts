import { RequestHandler } from "express";
import mongoose, { Types } from "mongoose";
import Community from "../models/community.model.js";
import Conversation from "../models/conversation.model.js";
import { io, userRoom } from "../lib/socket.js";

const MAX_GROUP_MEMBERS = 200;

const newKey = (prefix: string) => `${prefix}:${new mongoose.Types.ObjectId().toString()}`;

// case-insensitive exact-name matcher (escaped so names with regex chars are safe)
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameRegex = (name: string) => new RegExp(`^${esc(name.trim())}$`, "i");

// create a community + its announcement channel (admins-only posting)
export const createCommunity: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ message: "Community name is required" });
      return;
    }
    const cleanName = String(name).trim();

    // community names are unique (case-insensitive)
    const dupe = await Community.findOne({ name: nameRegex(cleanName) }).lean();
    if (dupe) {
      res.status(409).json({ message: "A community with that name already exists" });
      return;
    }

    const announcement = await new Conversation({
      key: newKey("community-ann"),
      participants: [myId],
      isGroup: true,
      isAnnouncement: true,
      onlyAdminsCanMessage: true,
      name: "Announcements",
      admins: [myId],
    }).save();

    const community = await new Community({
      name: cleanName,
      description: description ? String(description).trim() : undefined,
      admins: [myId],
      members: [myId],
      announcementId: announcement._id,
    }).save();

    announcement.communityId = community._id;
    await announcement.save();

    res.status(201).json({ community, announcement });
  } catch (error) {
    next(error);
  }
};

// communities I'm a member of, with group + member counts
export const getMyCommunities: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const communities = await Community.find({ members: myId }).sort({ updatedAt: -1 }).lean();

    const ids = communities.map((c) => c._id);
    const counts = await Conversation.aggregate([
      { $match: { communityId: { $in: ids }, isAnnouncement: { $ne: true } } },
      { $group: { _id: "$communityId", n: { $sum: 1 } } },
    ]);
    const groupCount = new Map(counts.map((c) => [String(c._id), c.n as number]));

    res.status(200).json(
      communities.map((c) => ({
        ...c,
        memberCount: c.members.length,
        groupCount: groupCount.get(String(c._id)) || 0,
        isAdmin: c.admins.map(String).includes(myId),
      }))
    );
  } catch (error) {
    next(error);
  }
};

// full community: announcement channel, its groups (with my membership), members
export const getCommunity: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;
    const community = await Community.findById(id)
      .populate("members", "fullName profilePic username")
      .lean();
    if (!community) return void res.status(404).json({ message: "Community not found" });

    const isMember = community.members.some((m) => String((m as { _id?: unknown })._id ?? m) === myId);
    if (!isMember) return void res.status(403).json({ message: "Join the community to view it" });

    const [announcement, groups] = await Promise.all([
      Conversation.findById(community.announcementId).lean(),
      Conversation.find({ communityId: id, isAnnouncement: { $ne: true } }).lean(),
    ]);

    res.status(200).json({
      community,
      isAdmin: community.admins.map(String).includes(myId),
      announcement,
      groups: groups.map((g) => ({
        ...g,
        memberCount: g.participants.length,
        isMember: g.participants.map(String).includes(myId),
      })),
    });
  } catch (error) {
    next(error);
  }
};

// admins create a new group inside the community
export const createCommunityGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { id } = req.params;
    const { name, members } = req.body;

    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!community.admins.map(String).includes(String(myId)))
      return void res.status(403).json({ message: "Admins only" });
    if (!name || !String(name).trim())
      return void res.status(400).json({ message: "Group name is required" });
    const cleanName = String(name).trim();

    // no two groups with the same name inside one community (case-insensitive)
    const dupe = await Conversation.findOne({
      communityId: community._id,
      isAnnouncement: { $ne: true },
      name: nameRegex(cleanName),
    }).lean();
    if (dupe)
      return void res.status(409).json({ message: "A group with that name already exists in this community" });

    const extra = Array.isArray(members) ? members.map(String) : [];
    const participants = Array.from(new Set([String(myId), ...extra]));
    if (participants.length > MAX_GROUP_MEMBERS)
      return void res.status(400).json({ message: `Groups can have at most ${MAX_GROUP_MEMBERS} members` });

    const conversation = await new Conversation({
      key: newKey("group"),
      participants,
      isGroup: true,
      name: cleanName,
      admins: [myId],
      communityId: community._id,
    }).save();

    for (const p of participants) {
      if (p !== String(myId)) io.to(userRoom(p)).emit("conversationCreated", conversation);
    }
    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
};

// join the community (and its announcement channel)
export const joinCommunity: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });

    if (!community.members.map(String).includes(String(myId))) {
      community.members.push(myId);
      await community.save();
      await Conversation.updateOne(
        { _id: community.announcementId },
        { $addToSet: { participants: myId } }
      );
      const ann = await Conversation.findById(community.announcementId);
      if (ann) io.to(userRoom(String(myId))).emit("conversationCreated", ann);
    }
    res.status(200).json(community);
  } catch (error) {
    next(error);
  }
};

// leave the community → drop out of the announcement channel and every group in it
export const leaveCommunity: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });

    await Community.updateOne({ _id: id }, { $pull: { members: myId, admins: myId } });
    await Conversation.updateMany({ communityId: id }, { $pull: { participants: myId } });
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// join one specific group within a community (you needn't be in every group)
export const joinCommunityGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { id, groupId } = req.params;
    const community = await Community.findById(id).lean();
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!community.members.map(String).includes(String(myId)))
      return void res.status(403).json({ message: "Join the community first" });

    const group = await Conversation.findOne({ _id: groupId, communityId: id, isAnnouncement: { $ne: true } });
    if (!group) return void res.status(404).json({ message: "Group not found" });

    if (!group.participants.map(String).includes(String(myId))) {
      if (group.participants.length >= MAX_GROUP_MEMBERS)
        return void res.status(403).json({ message: "Group is full" });
      group.participants.push(myId as unknown as Types.ObjectId);
      await group.save();
      io.to(userRoom(String(myId))).emit("conversationCreated", group);
    }
    res.status(200).json(group);
  } catch (error) {
    next(error);
  }
};
