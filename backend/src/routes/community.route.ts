import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createCommunity,
  getMyCommunities,
  getCommunity,
  createCommunityGroup,
  joinCommunity,
  leaveCommunity,
  joinCommunityGroup,
} from "../controllers/community.controller.js";

const router = express.Router();

router.get("/", protectRoute, getMyCommunities);
router.post("/", protectRoute, createCommunity);
router.get("/:id", protectRoute, getCommunity);
router.post("/:id/groups", protectRoute, createCommunityGroup);
router.post("/:id/join", protectRoute, joinCommunity);
router.post("/:id/leave", protectRoute, leaveCommunity);
router.post("/:id/groups/:groupId/join", protectRoute, joinCommunityGroup);

export default router;
