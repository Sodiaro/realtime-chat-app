import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getConversations,
  getMessages,
  getUsersForSidebar,
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
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/conversations", protectRoute, getConversations);
router.get("/search", protectRoute, searchMessages);

// group / conversation routes (kept above the generic /:id)
router.post("/group", protectRoute, createGroup);
router.get("/conversation/:conversationId", protectRoute, getConversationMessages);
router.post("/conversation/:conversationId", protectRoute, sendToConversation);

router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);

router.post("/:messageId/react", protectRoute, reactToMessage);
router.post("/:messageId/pin", protectRoute, pinMessage);
router.post("/:messageId/forward", protectRoute, forwardMessage);
router.post("/:messageId/report", protectRoute, reportMessage);
router.patch("/:messageId", protectRoute, updateMessage);
router.delete("/:messageId", protectRoute, deleteMessage);

export default router;
