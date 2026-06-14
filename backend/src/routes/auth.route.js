import express from "express";
import { login, logout, signup, updateProfile, checkAuth,} from "../controllers/auth.controller.js"
import { protectRoute } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.put("/update-profile", protectRoute, updateProfile);
router.get("/check", protectRoute, checkAuth)

export default router;