import { RequestHandler } from "express";
import mongoose, { Types } from "mongoose";
import Community from "../models/community.model.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { io, userRoom } from "../lib/socket.js";

const MAX_GROUP_MEMBERS = 200;

const newKey = (prefix: string) => `${prefix}:${new mongoose.Types.ObjectId().toString()}`;

// admins manage roles + everything; moderators manage groups; members participate
type RoleDoc = { admins: Types.ObjectId[]; moderators?: Types.ObjectId[] };
const isAdminOf = (c: RoleDoc, id: string) => c.admins.map(String).includes(id);
const canManageGroups = (c: RoleDoc, id: string) =>
  isAdminOf(c, id) || (c.moderators || []).map(String).includes(id);

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
      nameKey: cleanName.toLowerCase(),
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

    // fetch avatars for the first few members of each group (one batched query)
    const previewIds = new Set<string>();
    for (const g of groups) for (const p of (g.participants || []).slice(0, 4)) previewIds.add(String(p));
    const previewUsers = await User.find({ _id: { $in: [...previewIds] } })
      .select("fullName profilePic")
      .lean();
    const userMap = new Map(previewUsers.map((u) => [String(u._id), u]));

    res.status(200).json({
      community,
      isAdmin: community.admins.map(String).includes(myId),
      isModerator: (community.moderators || []).map(String).includes(myId),
      announcement,
      groups: groups.map((g) => ({
        ...g,
        memberCount: g.participants.length,
        isMember: g.participants.map(String).includes(myId),
        memberPreview: (g.participants || [])
          .slice(0, 4)
          .map((p) => userMap.get(String(p)))
          .filter(Boolean),
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
    if (!canManageGroups(community, String(myId)))
      return void res.status(403).json({ message: "Admins or moderators only" });
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
      nameKey: `c:${community._id}:${cleanName.toLowerCase()}`,
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

// community admins can edit a group's description (manage all associated groups)
export const updateCommunityGroup: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id, groupId } = req.params;
    const { description } = req.body;

    const community = await Community.findById(id).lean();
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!canManageGroups(community, myId))
      return void res.status(403).json({ message: "Admins or moderators only" });

    const group = await Conversation.findOne({ _id: groupId, communityId: id, isAnnouncement: { $ne: true } });
    if (!group) return void res.status(404).json({ message: "Group not found" });

    if (description !== undefined) group.description = String(description).slice(0, 500);
    await group.save();

    // reflect the change live for anyone with the group open
    const populated = await Conversation.findById(group._id).populate("participants", "-password");
    if (populated) {
      for (const p of populated.participants) {
        io.to(userRoom(String((p as { _id?: unknown })._id ?? p))).emit("conversationUpdated", populated);
      }
    }
    res.status(200).json(group);
  } catch (error) {
    next(error);
  }
};

// edit the community itself — name (unique), description, avatar (admins only)
export const updateCommunity: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;
    const { name, description, avatar } = req.body;

    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!isAdminOf(community, myId)) return void res.status(403).json({ message: "Admins only" });

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) return void res.status(400).json({ message: "Name can't be empty" });
      if (cleanName.toLowerCase() !== (community.name || "").toLowerCase()) {
        const dupe = await Community.findOne({ name: nameRegex(cleanName) }).lean();
        if (dupe && String(dupe._id) !== id)
          return void res.status(409).json({ message: "A community with that name already exists" });
      }
      community.name = cleanName;
      community.nameKey = cleanName.toLowerCase();
    }
    if (description !== undefined) community.description = String(description).slice(0, 500);
    if (avatar) {
      const { default: cloudinary } = await import("../lib/cloudinary.js");
      community.avatar = (await cloudinary.uploader.upload(avatar)).secure_url;
    }
    await community.save();
    res.status(200).json(community);
  } catch (error) {
    next(error);
  }
};

// promote/demote a member to admin / moderator / member (admins only)
export const setCommunityRole: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;
    const { userId, role } = req.body;
    if (!["admin", "moderator", "member"].includes(role))
      return void res.status(400).json({ message: "Invalid role" });

    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!isAdminOf(community, myId)) return void res.status(403).json({ message: "Admins only" });
    if (!community.members.map(String).includes(String(userId)))
      return void res.status(400).json({ message: "Not a member of this community" });

    const target = String(userId);
    const admins = community.admins.map(String).filter((a) => a !== target);
    const mods = (community.moderators || []).map(String).filter((m) => m !== target);
    if (role === "admin") admins.push(target);
    if (role === "moderator") mods.push(target);
    // never leave a community with zero admins
    if (admins.length === 0)
      return void res.status(400).json({ message: "A community needs at least one admin" });

    community.admins = admins as unknown as Types.ObjectId[];
    community.moderators = mods as unknown as Types.ObjectId[];
    await community.save();
    res.status(200).json({ admins: community.admins, moderators: community.moderators });
  } catch (error) {
    next(error);
  }
};

// ---- community invite links ----
export const createCommunityInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!isAdminOf(community, myId)) return void res.status(403).json({ message: "Admins only" });

    if (!community.inviteCode) {
      community.inviteCode = new mongoose.Types.ObjectId().toString();
      await community.save();
    }
    res.status(200).json({ inviteCode: community.inviteCode });
  } catch (error) {
    next(error);
  }
};

export const revokeCommunityInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return void res.status(404).json({ message: "Community not found" });
    if (!isAdminOf(community, myId)) return void res.status(403).json({ message: "Admins only" });
    community.inviteCode = undefined;
    await community.save();
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const previewCommunityInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = String(req.user!._id);
    const { code } = req.params;
    const community = await Community.findOne({ inviteCode: code }).lean();
    if (!community) return void res.status(404).json({ message: "Invalid or expired invite" });
    res.status(200).json({
      _id: community._id,
      name: community.name,
      avatar: community.avatar,
      description: community.description,
      memberCount: community.members.length,
      isMember: community.members.map(String).includes(myId),
    });
  } catch (error) {
    next(error);
  }
};

export const joinCommunityByInvite: RequestHandler = async (req, res, next) => {
  try {
    const myId = req.user!._id;
    const { code } = req.params;
    const community = await Community.findOne({ inviteCode: code });
    if (!community) return void res.status(404).json({ message: "Invalid or expired invite" });

    if (!community.members.map(String).includes(String(myId))) {
      community.members.push(myId);
      await community.save();
      await Conversation.updateOne({ _id: community.announcementId }, { $addToSet: { participants: myId } });
      const ann = await Conversation.findById(community.announcementId);
      if (ann) io.to(userRoom(String(myId))).emit("conversationCreated", ann);
    }
    res.status(200).json({ _id: community._id });
  } catch (error) {
    next(error);
  }
};
