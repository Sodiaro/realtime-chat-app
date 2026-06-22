import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createLimiter } from "../middleware/rateLimit.js";
import {
  createCommunity,
  getMyCommunities,
  getCommunity,
  updateCommunity,
  createCommunityGroup,
  updateCommunityGroup,
  setCommunityRole,
  joinCommunity,
  leaveCommunity,
  joinCommunityGroup,
  createCommunityInvite,
  revokeCommunityInvite,
  previewCommunityInvite,
  joinCommunityByInvite,
  discoverCommunities,
  removeCommunityMember,
} from "../controllers/community.controller.js";

const router = express.Router();

router.get("/", protectRoute, getMyCommunities);
router.post("/", protectRoute, createLimiter, createCommunity);

// discovery + invite links (kept above the generic /:id)
router.get("/discover", protectRoute, discoverCommunities);
router.get("/invite/:code", protectRoute, previewCommunityInvite);
router.post("/invite/:code/join", protectRoute, joinCommunityByInvite);

router.get("/:id", protectRoute, getCommunity);
router.patch("/:id", protectRoute, updateCommunity);
router.post("/:id/groups", protectRoute, createCommunityGroup);
router.patch("/:id/groups/:groupId", protectRoute, updateCommunityGroup);
router.post("/:id/role", protectRoute, setCommunityRole);
router.post("/:id/join", protectRoute, joinCommunity);
router.post("/:id/leave", protectRoute, leaveCommunity);
router.post("/:id/groups/:groupId/join", protectRoute, joinCommunityGroup);
router.post("/:id/invite", protectRoute, createLimiter, createCommunityInvite);
router.delete("/:id/invite", protectRoute, revokeCommunityInvite);
router.post("/:id/members/:userId/remove", protectRoute, removeCommunityMember);

export default router;
