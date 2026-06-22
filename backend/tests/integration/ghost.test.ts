import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";
import User from "../../src/models/user.model";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `gh_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `gh${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

const findMsg = (res: { body: { messages: { _id: string }[] } }, id: string) =>
  res.body.messages.find((m) => m._id === id);

describe("ghost mode", () => {
  it("anti-delete: ghost viewers recover a deleted message; others get a tombstone", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");

    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "secret" });
    expect(sent.status).toBe(201);
    await a.agent.delete(`/api/messages/${sent.body._id}`);

    // b as a normal user: tombstone, no original leaked
    let view = await b.agent.get(`/api/messages/${a.id}`);
    let msg = findMsg(view, sent.body._id) as Record<string, unknown>;
    expect(msg.deletedAt).toBeTruthy();
    expect(msg.text).toBeFalsy();
    expect(msg.original).toBeUndefined();
    expect(msg.antiDelete).toBeFalsy();

    // b turns on ghost mode → can recover the original
    await User.findByIdAndUpdate(b.id, { ghostMode: true });
    view = await b.agent.get(`/api/messages/${a.id}`);
    msg = findMsg(view, sent.body._id) as Record<string, unknown>;
    expect(msg.antiDelete).toBe(true);
    expect((msg.original as { text?: string }).text).toBe("secret");
  });

  it("a ghost user's own deletes vanish entirely (no tombstone for anyone)", async () => {
    const a = await makeUser("c");
    const b = await makeUser("d");
    await User.findByIdAndUpdate(b.id, { ghostMode: true });

    const sent = await b.agent.post(`/api/messages/send/${a.id}`).send({ text: "poof" });
    await b.agent.delete(`/api/messages/${sent.body._id}`);

    const aView = await a.agent.get(`/api/messages/${b.id}`);
    expect(findMsg(aView, sent.body._id)).toBeUndefined();
    const bView = await b.agent.get(`/api/messages/${a.id}`);
    expect(findMsg(bView, sent.body._id)).toBeUndefined();
  });

  it("a ghost user's edit leaves no 'edited' indicator", async () => {
    const a = await makeUser("e");
    const b = await makeUser("f");
    await User.findByIdAndUpdate(b.id, { ghostMode: true });

    const sent = await b.agent.post(`/api/messages/send/${a.id}`).send({ text: "v1" });
    const edited = await b.agent.patch(`/api/messages/${sent.body._id}`).send({ text: "v2" });
    expect(edited.status).toBe(200);
    expect(edited.body.text).toBe("v2");
    expect(edited.body.editedAt).toBeFalsy();
  });

  it("hides a ghost user's profile photo from contacts", async () => {
    const a = await makeUser("g");
    const b = await makeUser("h");
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    await User.findByIdAndUpdate(b.id, { profilePic: "http://img/x.png", ghostMode: true });

    const contacts = await a.agent.get("/api/messages/users");
    const peer = contacts.body.find((u: { _id: string }) => u._id === b.id);
    expect(peer.profilePic).toBe("");
  });
});
