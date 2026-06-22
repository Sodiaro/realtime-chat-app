import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { logCall, logGroupCall, getCalls } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCalls);
router.post("/", protectRoute, logCall);
router.post("/group", protectRoute, logGroupCall);

export default router;
