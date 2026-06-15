import type { RequestHandler } from "express";
import Report from "../models/report.model.js";

export const getReports: RequestHandler = async (req, res, next) => {
  try {
    const status = String(req.query.status || "open");
    const filter = status === "all" ? {} : { status };
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reporterId", "fullName email")
      .populate("messageId");
    res.status(200).json(reports);
  } catch (error) {
    next(error);
  }
};

export const resolveReport: RequestHandler = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body; // "resolved" | "dismissed"
    if (status !== "resolved" && status !== "dismissed") {
      res.status(400).json({ message: "Status must be 'resolved' or 'dismissed'" });
      return;
    }
    const report = await Report.findByIdAndUpdate(reportId, { status }, { new: true });
    if (!report) {
      res.status(404).json({ message: "Report not found" });
      return;
    }
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
};
