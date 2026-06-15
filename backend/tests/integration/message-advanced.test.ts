import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// avoid real Cloudinary calls for audio/image uploads
vi.mock("../../src/lib/cloudinary.js", () => ({
  default: {
    uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) },
  },
}));

import { app } from "../../src/app";
import User from "../../src/models/user.model";

async function makeUser(tag: string, fullName?: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: fullName || `User ${tag}`,
    email: `user_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `u${Date.now()}${Math.floor(Math.random() * 100000)}`,
  });
  return { agent, id: res.body._id as string };
}

describe("voice notes", () => {
  it("accepts an audio-only message", async () => {
    const a = await makeUser("va");
    const b = await makeUser("vb");
    const res = await a.agent
      .post(`/api/messages/send/${b.id}`)
      .send({ audio: "data:audio/webm;base64,AAAA" });
    expect(res.status).toBe(201);
    expect(res.body.audio).toBe("http://test/media");
  });
});

describe("mentions", () => {
  it("resolves @mentions to participant ids", async () => {
    const alice = await makeUser("ma", "Alice");
    const bob = await makeUser("mb", "Bob");
    const res = await alice.agent
      .post(`/api/messages/send/${bob.id}`)
      .send({ text: "hey @bob how are you" });
    expect(res.status).toBe(201);
    expect(res.body.mentions.map(String)).toContain(bob.id);
  });
});

describe("report & moderation", () => {
  it("lets a user report a message that an admin can review", async () => {
    const a = await makeUser("ra");
    const b = await makeUser("rb");
    const m = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "bad message" });

    const rep = await b.agent.post(`/api/messages/${m.body._id}/report`).send({ reason: "spam" });
    expect(rep.status).toBe(201);

    const admin = await makeUser("adm");
    await User.updateOne({ _id: admin.id }, { isAdmin: true });

    const reports = await admin.agent.get("/api/admin/reports");
    expect(reports.status).toBe(200);
    expect(reports.body.length).toBeGreaterThanOrEqual(1);
  });

  it("blocks admin routes for non-admins", async () => {
    const u = await makeUser("nadm");
    const res = await u.agent.get("/api/admin/reports");
    expect(res.status).toBe(403);
  });
});

describe("group chats", () => {
  it("creates a group and delivers messages to members", async () => {
    const a = await makeUser("ga");
    const b = await makeUser("gb");
    const c = await makeUser("gc");

    const grp = await a.agent.post("/api/messages/group").send({ name: "Team", members: [b.id, c.id] });
    expect(grp.status).toBe(201);
    expect(grp.body.isGroup).toBe(true);
    expect(grp.body.participants.map(String).sort()).toEqual([a.id, b.id, c.id].sort());

    const convId = grp.body._id;
    const sent = await a.agent.post(`/api/messages/conversation/${convId}`).send({ text: "hi team" });
    expect(sent.status).toBe(201);

    const bMsgs = await b.agent.get(`/api/messages/conversation/${convId}`);
    expect(bMsgs.body.messages.some((m: { text: string }) => m.text === "hi team")).toBe(true);
  });

  it("blocks non-participants from reading a conversation", async () => {
    const a = await makeUser("gp1");
    const b = await makeUser("gp2");
    const outsider = await makeUser("gp3");
    const grp = await a.agent.post("/api/messages/group").send({ name: "Private", members: [b.id] });

    const res = await outsider.agent.get(`/api/messages/conversation/${grp.body._id}`);
    expect(res.status).toBe(403);
  });
});
