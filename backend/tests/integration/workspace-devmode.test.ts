import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Force dev_mode ON so we can exercise authz/validation/audit. The flag-off 403 path
// is covered in workspace-devmode-flag-off.test.ts; flag evaluation in flags.test.ts.
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
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `wd_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `wd${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

const MISSING_ID = "665f1c2a9b1e4a0012abcd34"; // valid ObjectId, no such doc

describe("PATCH /api/messages/conversation/:id/devmode (group workspace)", () => {
  it("lets an admin enable Dev Mode and records audit fields", async () => {
    const owner = await makeUser("a");
    const member = await makeUser("b");
    const group = await owner.agent.post("/api/messages/group").send({ name: `G${Date.now()}a`, members: [member.id] });
    const gid = group.body._id as string;

    const res = await owner.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.devMode.enabled).toBe(true);
    expect(res.body.devMode.enabledBy).toBe(owner.id);
    expect(res.body.devMode.enabledAt).toBeTruthy();
  });

  it("lets an admin disable Dev Mode (explicit off, audit refreshed)", async () => {
    const owner = await makeUser("c");
    const member = await makeUser("c2");
    const group = await owner.agent.post("/api/messages/group").send({ name: `G${Date.now()}c`, members: [member.id] });
    const gid = group.body._id as string;
    await owner.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: true });

    const res = await owner.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.devMode.enabled).toBe(false); // present, not absent → explicit off
    expect(res.body.devMode.enabledBy).toBe(owner.id);
  });

  it("forbids a non-admin member", async () => {
    const owner = await makeUser("d");
    const member = await makeUser("e");
    const group = await owner.agent.post("/api/messages/group").send({ name: `G${Date.now()}d`, members: [member.id] });
    const gid = group.body._id as string;

    const res = await member.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: true });
    expect(res.status).toBe(403);
  });

  it("404s a non-existent group", async () => {
    const owner = await makeUser("f");
    const res = await owner.agent.patch(`/api/messages/conversation/${MISSING_ID}/devmode`).send({ enabled: true });
    expect(res.status).toBe(404);
  });

  it("404s a DM (DMs are not workspaces)", async () => {
    const a = await makeUser("g");
    const b = await makeUser("h");
    const send = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    const convId = send.body.conversationId as string;
    expect(convId).toMatch(/^[a-f0-9]{24}$/); // a real DM conversation id
    const res = await a.agent.patch(`/api/messages/conversation/${convId}/devmode`).send({ enabled: true });
    expect(res.status).toBe(404);
  });

  it("400s a non-boolean enabled", async () => {
    const owner = await makeUser("i");
    const member = await makeUser("i2");
    const group = await owner.agent.post("/api/messages/group").send({ name: `G${Date.now()}i`, members: [member.id] });
    const gid = group.body._id as string;
    const res = await owner.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: "yes" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/communities/:id/devmode (community workspace)", () => {
  it("lets an admin enable Dev Mode and records audit fields", async () => {
    const owner = await makeUser("j");
    const created = await owner.agent.post("/api/communities").send({ name: `C${Date.now()}j` });
    const cid = created.body.community._id as string;

    const res = await owner.agent.patch(`/api/communities/${cid}/devmode`).send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.devMode.enabled).toBe(true);
    expect(res.body.devMode.enabledBy).toBe(owner.id);
    expect(res.body.devMode.enabledAt).toBeTruthy();
  });

  it("forbids a non-admin member", async () => {
    const owner = await makeUser("k");
    const member = await makeUser("l");
    const created = await owner.agent.post("/api/communities").send({ name: `C${Date.now()}k` });
    const cid = created.body.community._id as string;
    await member.agent.post(`/api/communities/${cid}/join`);

    const res = await member.agent.patch(`/api/communities/${cid}/devmode`).send({ enabled: true });
    expect(res.status).toBe(403);
  });

  it("404s a non-existent community", async () => {
    const owner = await makeUser("m");
    const res = await owner.agent.patch(`/api/communities/${MISSING_ID}/devmode`).send({ enabled: true });
    expect(res.status).toBe(404);
  });

  it("400s a non-boolean enabled", async () => {
    const owner = await makeUser("n");
    const created = await owner.agent.post("/api/communities").send({ name: `C${Date.now()}n` });
    const cid = created.body.community._id as string;
    const res = await owner.agent.patch(`/api/communities/${cid}/devmode`).send({ enabled: "x" });
    expect(res.status).toBe(400);
  });
});
