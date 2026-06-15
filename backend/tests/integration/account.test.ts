import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

async function makeAgent(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `User ${tag}`,
    email: `user_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `u${Date.now()}${Math.floor(Math.random() * 100000)}`,
  });
  const cookie = String(res.headers["set-cookie"]?.[0]).split(";")[0];
  return { agent, id: res.body._id as string, cookie };
}

describe("change password", () => {
  it("rejects a wrong current password and accepts the right one", async () => {
    const a = await makeAgent("cpa");
    const wrong = await a.agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "nope", newPassword: "newpass123" });
    expect(wrong.status).toBe(400);

    const ok = await a.agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "secret123", newPassword: "newpass123" });
    expect(ok.status).toBe(200);
  });
});

describe("logout all devices", () => {
  it("invalidates older tokens via tokenVersion", async () => {
    const a = await makeAgent("loa");
    // old token still valid before
    expect((await request(app).get("/api/auth/check").set("Cookie", a.cookie)).status).toBe(200);

    await a.agent.post("/api/auth/logout-all"); // bumps tokenVersion, re-issues for this agent

    // the original cookie is now rejected
    const old = await request(app).get("/api/auth/check").set("Cookie", a.cookie);
    expect(old.status).toBe(401);

    // the agent (new cookie) still works
    expect((await a.agent.get("/api/auth/check")).status).toBe(200);
  });
});

describe("delete account", () => {
  it("removes the user", async () => {
    const a = await makeAgent("dela");
    const del = await a.agent.delete("/api/auth/me");
    expect(del.status).toBe(200);

    const after = await a.agent.get("/api/auth/check");
    expect([401, 404]).toContain(after.status);
  });
});
