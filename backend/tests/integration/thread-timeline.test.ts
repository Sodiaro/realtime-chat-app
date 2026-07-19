import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";
import Message from "../../src/models/message.model.js";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `th_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `th${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

const textsOf = (body: { messages: { text?: string }[] }) => body.messages.map((m) => m.text);
const idsOf = (body: { messages: { _id: string }[] }) => body.messages.map((m) => m._id);

describe("thread replies and the main timeline", () => {
  it("keeps ordinary messages top-level", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");

    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hello" });

    expect(sent.status).toBe(201);
    expect(sent.body.threadRoot).toBeUndefined();
    expect(sent.body.threadCount).toBeUndefined();
  });

  it("excludes thread replies from a DM timeline", async () => {
    const a = await makeUser("c");
    const b = await makeUser("d");
    const root = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "root" });

    await Message.create({
      conversationId: root.body.conversationId,
      senderId: a.id,
      receiverId: b.id,
      text: "thread reply",
      threadRoot: root.body._id,
    });

    const page = await a.agent.get(`/api/messages/${b.id}`);

    expect(idsOf(page.body)).toContain(root.body._id);
    expect(textsOf(page.body)).not.toContain("thread reply");
  });

  it("excludes thread replies from a group timeline", async () => {
    const owner = await makeUser("e");
    const member = await makeUser("f");
    const group = await owner.agent
      .post("/api/messages/group")
      .send({ name: `TH${Date.now()}`, members: [member.id] });
    const gid = group.body._id as string;
    const root = await owner.agent.post(`/api/messages/conversation/${gid}`).send({ text: "root" });

    await Message.create({
      conversationId: gid,
      senderId: owner.id,
      text: "thread reply",
      threadRoot: root.body._id,
    });

    const page = await owner.agent.get(`/api/messages/conversation/${gid}`);

    expect(idsOf(page.body)).toContain(root.body._id);
    expect(textsOf(page.body)).not.toContain("thread reply");
  });
});
