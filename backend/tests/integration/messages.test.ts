import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

// signs up a user and returns an agent (keeps the cookie) plus the user id
async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `User ${tag}`,
    email: `user_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `u${Date.now()}${Math.floor(Math.random() * 100000)}`,
  });
  return { agent, id: res.body._id as string };
}

describe("messages", () => {
  it("requires auth to send", async () => {
    const res = await request(app).post("/api/messages/send/000000000000000000000000").send({ text: "hi" });
    expect(res.status).toBe(401);
  });

  it("rejects an empty message", async () => {
    const a = await makeUser("empty-a");
    const b = await makeUser("empty-b");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({});
    expect(res.status).toBe(400);
  });

  it("sends a message with a conversationId and delivers history oldest→newest", async () => {
    const a = await makeUser("hist-a");
    const b = await makeUser("hist-b");

    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "msg 1" });
    expect(sent.status).toBe(201);
    expect(sent.body.conversationId).toBeDefined();
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "msg 2" });

    const page = await b.agent.get(`/api/messages/${a.id}`);
    expect(page.status).toBe(200);
    expect(page.body).toHaveProperty("messages");
    expect(page.body).toHaveProperty("nextCursor");
    expect(page.body.messages.map((m: { text: string }) => m.text)).toEqual(["msg 1", "msg 2"]);
  });

  it("tracks unread counts and resets them when the chat is opened", async () => {
    const a = await makeUser("unread-a");
    const b = await makeUser("unread-b");

    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "1" });
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "2" });

    let convs = (await b.agent.get("/api/messages/conversations")).body;
    expect(convs).toHaveLength(1);
    expect(convs[0].unread).toBe(2);
    expect(convs[0].lastMessage.text).toBe("2");

    await b.agent.get(`/api/messages/${a.id}`); // open the chat

    convs = (await b.agent.get("/api/messages/conversations")).body;
    expect(convs[0].unread).toBe(0);
  });

  it("dedups: both users see the same single conversation", async () => {
    const a = await makeUser("dedup-a");
    const b = await makeUser("dedup-b");
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });

    const convA = (await a.agent.get("/api/messages/conversations")).body;
    const convB = (await b.agent.get("/api/messages/conversations")).body;
    expect(convA).toHaveLength(1);
    expect(convB).toHaveLength(1);
    expect(String(convA[0]._id)).toBe(String(convB[0]._id));
  });
});
