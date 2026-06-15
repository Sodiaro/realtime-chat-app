import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("metrics", () => {
  it("exposes /metrics in Prometheus text format", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("socket_connections_active");
    expect(res.text).toContain("messages_sent_total");
  });

  it("counts a sent message in messages_sent_total", async () => {
    const a = request.agent(app);
    const ra = await a
      .post("/api/auth/signup")
      .send({ fullName: "MA", email: `ma_${Date.now()}@test.com`, password: "secret123" });
    const b = request.agent(app);
    const rb = await b
      .post("/api/auth/signup")
      .send({ fullName: "MB", email: `mb_${Date.now()}@test.com`, password: "secret123" });

    await a.post(`/api/messages/send/${rb.body._id}`).send({ text: "metric me" });

    const res = await request(app).get("/metrics");
    const line = res.text.split("\n").find((l) => l.startsWith("messages_sent_total"));
    expect(line).toBeDefined();
    expect(Number(line!.split(" ").pop())).toBeGreaterThanOrEqual(1);
    // (ra used only to create the sender)
    expect(ra.status).toBe(201);
  });
});
