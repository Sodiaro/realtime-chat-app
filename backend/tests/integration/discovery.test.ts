import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import Message from "../../src/models/message.model";

async function makeUser(tag: string, username?: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `User ${tag}`,
    email: `user_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: username || `u${Date.now()}${Math.floor(Math.random() * 100000)}`,
  });
  return { agent, id: res.body._id as string, body: res.body };
}

describe("username + discovery", () => {
  it("signs up with a username and reports availability", async () => {
    const a = await makeUser("ua", "alice_test");
    expect(a.body.username).toBe("alice_test");

    const taken = await request(app).get("/api/auth/check-username").query({ username: "alice_test" });
    expect(taken.body.available).toBe(false);

    const free = await request(app).get("/api/auth/check-username").query({ username: "totally_free_name" });
    expect(free.body.available).toBe(true);
  });

  it("rejects a duplicate username at signup", async () => {
    await makeUser("ub", "dupuser");
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/signup").send({
      fullName: "X",
      email: `x_${Date.now()}@test.com`,
      password: "secret123",
      username: "dupuser",
    });
    expect(res.status).toBe(409);
  });

  it("searches users by username", async () => {
    await makeUser("sa", "searchme123");
    const b = await makeUser("sb");
    const res = await b.agent.get("/api/messages/users/search").query({ q: "searchme" });
    expect(res.status).toBe(200);
    expect(res.body.some((u: { username: string }) => u.username === "searchme123")).toBe(true);
  });

  it("sidebar users returns only contacts you've messaged", async () => {
    const a = await makeUser("ca");
    const b = await makeUser("cb");
    const c = await makeUser("cc");
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });

    const contacts = (await a.agent.get("/api/messages/users")).body;
    const ids = contacts.map((u: { _id: string }) => String(u._id));
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(c.id);
  });
});

describe("edit/delete 10-minute window", () => {
  it("blocks editing/deleting a message older than 10 minutes", async () => {
    const a = await makeUser("ea");
    const b = await makeUser("eb");
    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "old" });
    await Message.updateOne(
      { _id: sent.body._id },
      { $set: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } },
      { timestamps: false, overwriteImmutable: true }
    );

    const edit = await a.agent.patch(`/api/messages/${sent.body._id}`).send({ text: "new" });
    expect(edit.status).toBe(403);
    const del = await a.agent.delete(`/api/messages/${sent.body._id}`);
    expect(del.status).toBe(403);
  });

  it("allows editing a recent message", async () => {
    const a = await makeUser("ra");
    const b = await makeUser("rb");
    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "recent" });
    const edit = await a.agent.patch(`/api/messages/${sent.body._id}`).send({ text: "edited" });
    expect(edit.status).toBe(200);
  });
});
