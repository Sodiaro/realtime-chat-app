import client from "prom-client";
import { env } from "./env.js";

export const register = new client.Registry();
register.setDefaultLabels({ app: "devchat-backend" });

if (env.NODE_ENV !== "test") {
  client.collectDefaultMetrics({ register });
}

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const socketConnectionsActive = new client.Gauge({
  name: "socket_connections_active",
  help: "Currently connected Socket.IO clients on this instance",
  registers: [register],
});

export const messagesSentTotal = new client.Counter({
  name: "messages_sent_total",
  help: "Total chat messages sent",
  registers: [register],
});
