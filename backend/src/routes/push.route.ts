import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getPublicKey, subscribe, unsubscribe } from "../controllers/push.controller.js";

const router = express.Router();

router.get("/public-key", getPublicKey);
router.post("/subscribe", protectRoute, subscribe);
router.post("/unsubscribe", protectRoute, unsubscribe);

export default router;
