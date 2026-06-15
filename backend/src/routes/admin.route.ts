import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { getReports, resolveReport } from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/reports", protectRoute, requireAdmin, getReports);
router.patch("/reports/:reportId", protectRoute, requireAdmin, resolveReport);

export default router;
