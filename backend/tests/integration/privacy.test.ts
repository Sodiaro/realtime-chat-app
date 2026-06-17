import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";
import User from "../../src/models/user.model.js";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `pv_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `pv${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("privacy settings", () => {
  it("defaults to everyone visible + receipts on, and updates", async () => {
    const a = await makeUser("a");
    const me = await a.agent.get("/api/auth/check");
    expect(me.body.privacy.lastSeen).toBe("everyone");
    expect(me.body.privacy.readReceipts).toBe(true);

    const upd = await a.agent.post("/api/auth/privacy").send({
      lastSeen: "nobody",
      readReceipts: false,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.privacy.lastSeen).toBe("nobody");
    expect(upd.body.privacy.readReceipts).toBe(false);
  });

  it("rejects an invalid visibility value", async () => {
    const a = await makeUser("b");
    const res = await a.agent.post("/api/auth/privacy").send({ lastSeen: "friends" });
    expect(res.status).toBe(400);
  });

  it("hides last seen + photo from contacts when set to nobody", async () => {
    const a = await makeUser("c");
    const b = await makeUser("d");

    // make them DM contacts + give b a profile photo + lastSeen
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    await User.findByIdAndUpdate(b.id, {
      profilePic: "http://img/b.png",
      lastSeen: new Date(),
      "privacy.lastSeen": "nobody",
      "privacy.profilePhoto": "nobody",
    });

    const contacts = await a.agent.get("/api/messages/users");
    const peer = contacts.body.find((u: { _id: string }) => u._id === b.id);
    expect(peer).toBeTruthy();
    expect(peer.lastSeen).toBeUndefined();
    expect(peer.profilePic).toBe("");
    expect(peer.privacy).toBeUndefined(); // others' privacy settings aren't leaked
  });

  it("still shows last seen to contacts when set to contacts-only", async () => {
    const a = await makeUser("e");
    const b = await makeUser("f");
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    await User.findByIdAndUpdate(b.id, {
      lastSeen: new Date(),
      "privacy.lastSeen": "contacts",
    });
    const contacts = await a.agent.get("/api/messages/users");
    const peer = contacts.body.find((u: { _id: string }) => u._id === b.id);
    expect(peer.lastSeen).toBeTruthy();
  });
});
