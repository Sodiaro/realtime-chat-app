import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { logCall, getCalls } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCalls);
router.post("/", protectRoute, logCall);

export default router;
