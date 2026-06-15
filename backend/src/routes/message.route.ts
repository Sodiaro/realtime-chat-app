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
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/conversations", protectRoute, getConversations);
router.get("/search", protectRoute, searchMessages); // before /:id
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);
router.post("/:messageId/react", protectRoute, reactToMessage);
router.post("/:messageId/pin", protectRoute, pinMessage);
router.post("/:messageId/forward", protectRoute, forwardMessage);
router.patch("/:messageId", protectRoute, updateMessage);
router.delete("/:messageId", protectRoute, deleteMessage);

export default router;
