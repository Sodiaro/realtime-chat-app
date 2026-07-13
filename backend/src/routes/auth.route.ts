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
  updateDevMode,
  getSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { withFlags } from "../middleware/flags.middleware.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/check-username", checkUsername); // public, used during signup
router.post("/signup", authLimiter, signup);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/login", authLimiter, login);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/logout", logout);
router.put("/update-profile", protectRoute, updateProfile);
router.post("/privacy", protectRoute, updatePrivacy);
router.post("/devmode", protectRoute, withFlags, updateDevMode); // flag-gated
router.get("/check", protectRoute, withFlags, checkAuth); // withFlags → req.flags
router.post("/block/:id", protectRoute, blockUser);
router.post("/change-password", protectRoute, changePassword);
router.post("/logout-all", protectRoute, logoutAllDevices);
router.get("/sessions", protectRoute, getSessions);
router.delete("/sessions/:id", protectRoute, revokeSession);
router.delete("/me", protectRoute, deleteAccount);

export default router;
