import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Force the dev_mode flag ON for this file so we can exercise the success/validation
// paths. The flag is OFF by default in the test env (vitest.config.ts), so the 403
// gate is covered separately in devmode-flag-off.test.ts. (Flag *evaluation* itself
// is unit-tested in tests/unit/flags.test.ts.)
vi.mock("../../src/middleware/flags.middleware.js", () => ({
  withFlags: (req: any, _res: any, next: any) => {
    req.flags = { dev_mode: true };
    next();
  },
}));

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `dm_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `dm${Date.now()}${tag}`.slice(0, 18),
  });
  return agent;
}

describe("POST /api/auth/devmode (flag enabled)", () => {
  it("enables personal Dev Mode and returns user + flag snapshot", async () => {
    const agent = await makeUser("a");
    const res = await agent.post("/api/auth/devmode").send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.devMode.enabled).toBe(true);
    expect(res.body.devMode.defaultForNewWorkspaces).toBe(false);
    expect(res.body.flags).toEqual({ dev_mode: true }); // same shape as /auth/check
    expect(res.body.password).toBeUndefined();
  });

  it("updates defaultForNewWorkspaces independently of enabled", async () => {
    const agent = await makeUser("b");
    const res = await agent.post("/api/auth/devmode").send({ defaultForNewWorkspaces: true });
    expect(res.status).toBe(200);
    expect(res.body.devMode.defaultForNewWorkspaces).toBe(true);
    expect(res.body.devMode.enabled).toBe(false); // untouched
  });

  it("persists across requests (visible on /auth/check)", async () => {
    const agent = await makeUser("c");
    await agent.post("/api/auth/devmode").send({ enabled: true, defaultForNewWorkspaces: true });
    const check = await agent.get("/api/auth/check");
    expect(check.body.devMode).toEqual({ enabled: true, defaultForNewWorkspaces: true });
  });

  it("rejects an empty body (nothing to update)", async () => {
    const agent = await makeUser("d");
    const res = await agent.post("/api/auth/devmode").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a non-boolean value", async () => {
    const agent = await makeUser("e");
    const res = await agent.post("/api/auth/devmode").send({ enabled: "yes" });
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/auth/devmode").send({ enabled: true });
    expect(res.status).toBe(401);
  });
});
