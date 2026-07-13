import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// No flags mock: real withFlags runs against the default test env (FEATURE_DEV_MODE
// unset ⇒ dev_mode OFF), so the admin-only toggles must reject with 403 even for admins.
vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `wdoff_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `wo${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("workspace devmode — flag disabled (default)", () => {
  it("returns 403 for a group admin when dev_mode is off", async () => {
    const owner = await makeUser("a");
    const member = await makeUser("b");
    const group = await owner.agent.post("/api/messages/group").send({ name: `Goff${Date.now()}`, members: [member.id] });
    const gid = group.body._id as string;

    const res = await owner.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: true });
    expect(res.status).toBe(403);
  });

  it("returns 403 for a community admin when dev_mode is off", async () => {
    const owner = await makeUser("c");
    const created = await owner.agent.post("/api/communities").send({ name: `Coff${Date.now()}` });
    const cid = created.body.community._id as string;

    const res = await owner.agent.patch(`/api/communities/${cid}/devmode`).send({ enabled: true });
    expect(res.status).toBe(403);
  });
});
