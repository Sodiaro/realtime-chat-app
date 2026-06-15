import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

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

async function send(a: Awaited<ReturnType<typeof makeUser>>, toId: string, text: string) {
  const res = await a.agent.post(`/api/messages/send/${toId}`).send({ text });
  return res.body._id as string;
}

describe("message editing", () => {
  it("lets the sender edit and stamps editedAt", async () => {
    const a = await makeUser("ea");
    const b = await makeUser("eb");
    const id = await send(a, b.id, "original");

    const res = await a.agent.patch(`/api/messages/${id}`).send({ text: "updated" });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("updated");
    expect(res.body.editedAt).toBeTruthy();
  });

  it("forbids editing someone else's message", async () => {
    const a = await makeUser("ea2");
    const b = await makeUser("eb2");
    const id = await send(a, b.id, "mine");

    const res = await b.agent.patch(`/api/messages/${id}`).send({ text: "hax" });
    expect(res.status).toBe(403);
  });
});

describe("message deletion", () => {
  it("soft-deletes: clears text and sets deletedAt", async () => {
    const a = await makeUser("da");
    const b = await makeUser("db");
    const id = await send(a, b.id, "delete me");

    const res = await a.agent.delete(`/api/messages/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).toBeTruthy();
    expect(res.body.text == null).toBe(true);
  });
});

describe("reactions", () => {
  it("adds then toggles off a reaction", async () => {
    const a = await makeUser("ra");
    const b = await makeUser("rb");
    const id = await send(a, b.id, "react to me");

    const add = await b.agent.post(`/api/messages/${id}/react`).send({ emoji: "👍" });
    expect(add.status).toBe(200);
    expect(add.body.reactions).toHaveLength(1);
    expect(add.body.reactions[0].emoji).toBe("👍");

    const toggle = await b.agent.post(`/api/messages/${id}/react`).send({ emoji: "👍" });
    expect(toggle.body.reactions).toHaveLength(0);
  });

  it("rejects reactions from non-participants", async () => {
    const a = await makeUser("rpa");
    const b = await makeUser("rpb");
    const c = await makeUser("rpc");
    const id = await send(a, b.id, "private");

    const res = await c.agent.post(`/api/messages/${id}/react`).send({ emoji: "❤️" });
    expect(res.status).toBe(403);
  });
});

describe("search", () => {
  it("finds matching messages within a conversation", async () => {
    const a = await makeUser("sa");
    const b = await makeUser("sb");
    await send(a, b.id, "the quick brown fox");
    await send(a, b.id, "lazy dog");

    const res = await a.agent.get("/api/messages/search").query({ q: "brown", with: b.id });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].text).toContain("brown");
  });

  it("excludes deleted messages from search", async () => {
    const a = await makeUser("sda");
    const b = await makeUser("sdb");
    const id = await send(a, b.id, "findme then gone");
    await a.agent.delete(`/api/messages/${id}`);

    const res = await a.agent.get("/api/messages/search").query({ q: "findme", with: b.id });
    expect(res.body).toHaveLength(0);
  });
});
