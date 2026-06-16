import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import Message from "../../src/models/message.model";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `dis_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `d${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("disappearing messages", () => {
  it("sets a timer and stamps expiresAt on new messages", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "first" });

    const convs = (await a.agent.get("/api/messages/conversations")).body;
    const dm = convs.find((c: { isGroup: boolean }) => !c.isGroup);
    const set = await a.agent
      .post(`/api/messages/conversation/${dm._id}/disappearing`)
      .send({ minutes: 60 });
    expect(set.body.disappearMinutes).toBe(60);

    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "vanishing" });
    expect(sent.body.expiresAt).toBeTruthy();
  });

  it("hides expired messages from history", async () => {
    const a = await makeUser("ea");
    const b = await makeUser("eb");
    const m = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "old" });
    await Message.updateOne(
      { _id: m.body._id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const page = (await b.agent.get(`/api/messages/${a.id}`)).body;
    expect(page.messages.some((x: { _id: string }) => x._id === m.body._id)).toBe(false);
  });
});

describe("web push", () => {
  it("exposes the public-key endpoint and accepts a subscription", async () => {
    const a = await makeUser("pa");
    const key = await request(app).get("/api/push/public-key");
    expect(key.status).toBe(200);

    const sub = await a.agent.post("/api/push/subscribe").send({
      subscription: { endpoint: `https://push.example/${Date.now()}`, keys: { p256dh: "x", auth: "y" } },
    });
    expect(sub.status).toBe(201);
  });
});
