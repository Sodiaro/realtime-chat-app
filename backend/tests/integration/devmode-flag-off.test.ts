import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// No flags mock here: the real withFlags runs against the default test env where
// FEATURE_DEV_MODE is unset ⇒ dev_mode is OFF ⇒ the endpoint must reject with 403.
vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `dmoff_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `dmo${Date.now()}${tag}`.slice(0, 18),
  });
  return agent;
}

describe("POST /api/auth/devmode (flag disabled — default)", () => {
  it("returns 403 when the dev_mode flag is off", async () => {
    const agent = await makeUser("a");
    const res = await agent.post("/api/auth/devmode").send({ enabled: true });
    expect(res.status).toBe(403);
  });

  it("does not persist any change when gated", async () => {
    const agent = await makeUser("b");
    await agent.post("/api/auth/devmode").send({ enabled: true });
    const check = await agent.get("/api/auth/check");
    expect(check.body.devMode.enabled).toBe(false); // unchanged
  });
});
