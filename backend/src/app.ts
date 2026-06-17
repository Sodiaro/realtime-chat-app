import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import { pinoHttp } from "pino-http";
import { randomUUID } from "crypto";
import path from "path";

import { openapiSpec } from "./lib/swagger.js";
import { logger } from "./lib/logger.js";
import { register, httpRequestDuration, httpRequestsTotal } from "./lib/metrics.js";
import { env, corsOrigins } from "./lib/env.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import adminRoutes from "./routes/admin.route.js";
import pushRoutes from "./routes/push.route.js";
import callRoutes from "./routes/call.route.js";
import statusRoutes from "./routes/status.route.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { app } from "./lib/socket.js";

const __dirname = path.resolve();

// correlation id: reuse an incoming x-request-id or mint one, echo it back
app.use((req, res, next) => {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  req.id = id;
  res.setHeader("x-request-id", id);
  next();
});

// structured request logging, tagged with the correlation id
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id as string,
    autoLogging: {
      ignore: (req) => ["/health", "/ready", "/metrics"].includes(req.url || ""),
    },
  })
);

// record latency + count for every request, labelled by matched route
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
});

app.use(helmet());
app.use(express.json({ limit: "12mb" })); // base64 files/images
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// API docs — relax CSP here so Swagger UI's assets load
app.get("/api-docs.json", (_req, res) => res.json(openapiSpec));
app.use(
  "/api-docs",
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: "DevChat API" })
);

// keep these above the rate limiter and SPA catch-all
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

// Prometheus scrape target. In prod, restrict this to the monitoring network.
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/status", statusRoutes);

if (env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

app.use(errorHandler);

export { app };
