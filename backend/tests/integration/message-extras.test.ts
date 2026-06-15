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

describe("reply", () => {
  it("stores replyTo and returns it populated", async () => {
    const a = await makeUser("rpa");
    const b = await makeUser("rpb");
    const first = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "first" });
    const second = await a.agent
      .post(`/api/messages/send/${b.id}`)
      .send({ text: "second", replyTo: first.body._id });

    expect(second.status).toBe(201);
    expect(second.body.replyTo).toBeTruthy();
    expect(second.body.replyTo.text).toBe("first");
  });
});

describe("pin", () => {
  it("toggles pinnedAt", async () => {
    const a = await makeUser("pna");
    const b = await makeUser("pnb");
    const m = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "pin me" });

    const pinned = await a.agent.post(`/api/messages/${m.body._id}/pin`);
    expect(pinned.body.pinnedAt).toBeTruthy();

    const unpinned = await a.agent.post(`/api/messages/${m.body._id}/pin`);
    expect(unpinned.body.pinnedAt == null).toBe(true);
  });
});

describe("forward", () => {
  it("copies a message into another conversation with forwardedFrom set", async () => {
    const a = await makeUser("fwa");
    const b = await makeUser("fwb");
    const c = await makeUser("fwc");
    const m = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "forward me" });

    const fwd = await a.agent.post(`/api/messages/${m.body._id}/forward`).send({ to: c.id });
    expect(fwd.status).toBe(201);
    expect(fwd.body.text).toBe("forward me");
    expect(String(fwd.body.forwardedFrom)).toBe(a.id);
    expect(String(fwd.body.receiverId)).toBe(c.id);

    const cMsgs = await c.agent.get(`/api/messages/${a.id}`);
    expect(cMsgs.body.messages.some((x: { text: string }) => x.text === "forward me")).toBe(true);
  });
});

describe("blocking", () => {
  it("blocks messaging both directions and unblocks", async () => {
    const a = await makeUser("bka");
    const b = await makeUser("bkb");

    const blk = await a.agent.post(`/api/auth/block/${b.id}`);
    expect(blk.status).toBe(200);
    expect(blk.body.blockedUsers.map(String)).toContain(b.id);

    const aToB = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    expect(aToB.status).toBe(403);

    const bToA = await b.agent.post(`/api/messages/send/${a.id}`).send({ text: "hi" });
    expect(bToA.status).toBe(403);

    await a.agent.post(`/api/auth/block/${b.id}`); // unblock
    const again = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi again" });
    expect(again.status).toBe(201);
  });

  it("rejects blocking yourself", async () => {
    const a = await makeUser("bks");
    const res = await a.agent.post(`/api/auth/block/${a.id}`);
    expect(res.status).toBe(400);
  });
});
