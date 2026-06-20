import express from "express";
import {
  login,
  logout,
  signup,
  updateProfile,
  checkAuth,
  blockUser,
  changePassword,
  logoutAllDevices,
  deleteAccount,
  checkUsername,
  verifyEmail,
  resendOtp,
  updatePrivacy,
  getSessions,
  revokeSession,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/check-username", checkUsername); // public, used during signup
router.post("/signup", authLimiter, signup);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.put("/update-profile", protectRoute, updateProfile);
router.post("/privacy", protectRoute, updatePrivacy);
router.get("/check", protectRoute, checkAuth);
router.post("/block/:id", protectRoute, blockUser);
router.post("/change-password", protectRoute, changePassword);
router.post("/logout-all", protectRoute, logoutAllDevices);
router.get("/sessions", protectRoute, getSessions);
router.delete("/sessions/:id", protectRoute, revokeSession);
router.delete("/me", protectRoute, deleteAccount);

export default router;
