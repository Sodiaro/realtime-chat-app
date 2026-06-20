import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getConversations,
  getMessages,
  getUsersForSidebar,
  searchUsers,
  sendMessage,
  updateMessage,
  deleteMessage,
  reactToMessage,
  searchMessages,
  pinMessage,
  forwardMessage,
  reportMessage,
  createGroup,
  getConversationMessages,
  sendToConversation,
  toggleMute,
  toggleArchive,
  togglePin,
  setDisappearing,
  starMessage,
  votePoll,
  getStarred,
  scheduleMessage,
  getScheduledMessages,
  cancelScheduledMessage,
  getSharedMedia,
  renameGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/users/search", protectRoute, searchUsers);
router.get("/conversations", protectRoute, getConversations);
router.get("/search", protectRoute, searchMessages);
router.get("/starred", protectRoute, getStarred);

// scheduled messages (kept above the generic /:id)
router.get("/scheduled", protectRoute, getScheduledMessages);
router.post("/scheduled", protectRoute, scheduleMessage);
router.delete("/scheduled/:id", protectRoute, cancelScheduledMessage);

// group / conversation routes (kept above the generic /:id)
router.post("/group", protectRoute, createGroup);
router.get("/conversation/:conversationId", protectRoute, getConversationMessages);
router.get("/conversation/:conversationId/shared", protectRoute, getSharedMedia);
router.post("/conversation/:conversationId", protectRoute, sendToConversation);
router.patch("/conversation/:conversationId", protectRoute, renameGroup);
router.post("/conversation/:conversationId/mute", protectRoute, toggleMute);
router.post("/conversation/:conversationId/archive", protectRoute, toggleArchive);
router.post("/conversation/:conversationId/pin", protectRoute, togglePin);
router.post("/conversation/:conversationId/disappearing", protectRoute, setDisappearing);
router.post("/conversation/:conversationId/members", protectRoute, addGroupMembers);
router.delete("/conversation/:conversationId/members/:userId", protectRoute, removeGroupMember);
router.post("/conversation/:conversationId/leave", protectRoute, leaveGroup);

router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);

router.post("/:messageId/react", protectRoute, reactToMessage);
router.post("/:messageId/pin", protectRoute, pinMessage);
router.post("/:messageId/forward", protectRoute, forwardMessage);
router.post("/:messageId/report", protectRoute, reportMessage);
router.post("/:messageId/star", protectRoute, starMessage);
router.post("/:messageId/vote", protectRoute, votePoll);
router.patch("/:messageId", protectRoute, updateMessage);
router.delete("/:messageId", protectRoute, deleteMessage);

export default router;
