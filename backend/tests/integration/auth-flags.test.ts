import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

// signup (test env) logs the user in via cookie, so the agent can hit /check.
async function makeUser(tag: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `flags_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `fl${Date.now()}${tag}`.slice(0, 18),
  });
  return agent;
}

describe("GET /api/auth/check — feature flags + devMode", () => {
  it("returns a feature-flag snapshot (dev_mode off by default in tests)", async () => {
    const agent = await makeUser("a");
    const res = await agent.get("/api/auth/check");
    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual({ dev_mode: false });
  });

  it("returns the user's devMode preference with safe defaults", async () => {
    const agent = await makeUser("b");
    const res = await agent.get("/api/auth/check");
    expect(res.body.devMode).toEqual({ enabled: false, defaultForNewWorkspaces: false });
  });

  it("preserves the core user fields and never leaks the password", async () => {
    const agent = await makeUser("c");
    const res = await agent.get("/api/auth/check");
    expect(res.body._id).toBeDefined();
    expect(res.body.email).toBeDefined();
    expect(res.body.privacy).toBeDefined(); // existing shape intact
    expect(res.body.password).toBeUndefined();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/auth/check");
    expect(res.status).toBe(401);
    expect(res.body.flags).toBeUndefined(); // no snapshot for anonymous requests
  });
});
