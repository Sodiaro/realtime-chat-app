import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";
import { flushDueScheduledMessages } from "../../src/lib/scheduler.js";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `x3_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `x3${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("scheduled messages", () => {
  it("rejects a time in the past", async () => {
    const a = await makeUser("spast");
    const b = await makeUser("spastb");
    const res = await a.agent.post("/api/messages/scheduled").send({
      to: b.id,
      text: "too late",
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it("schedules, lists, and delivers when due", async () => {
    const a = await makeUser("sa");
    const b = await makeUser("sb");

    // schedule ~1s out so the poller picks it up on flush
    const sched = await a.agent.post("/api/messages/scheduled").send({
      to: b.id,
      text: "ping from the past",
      scheduledAt: new Date(Date.now() + 800).toISOString(),
    });
    expect(sched.status).toBe(201);
    expect(sched.body.status).toBe("pending");

    // it shows up in the sender's pending list
    const list = await a.agent.get("/api/messages/scheduled");
    expect(list.body.some((s: { _id: string }) => s._id === sched.body._id)).toBe(true);

    // wait until due, then flush the poller manually
    await new Promise((r) => setTimeout(r, 900));
    await flushDueScheduledMessages();

    // the recipient now has the real message in their thread
    const msgs = await b.agent.get(`/api/messages/${a.id}`);
    expect(msgs.body.messages.some((m: { text: string }) => m.text === "ping from the past")).toBe(true);

    // and it's no longer pending
    const after = await a.agent.get("/api/messages/scheduled");
    expect(after.body.some((s: { _id: string }) => s._id === sched.body._id)).toBe(false);
  });

  it("cancels a pending scheduled message before it sends", async () => {
    const a = await makeUser("sc");
    const b = await makeUser("scb");
    const sched = await a.agent.post("/api/messages/scheduled").send({
      to: b.id,
      text: "never sent",
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const cancel = await a.agent.delete(`/api/messages/scheduled/${sched.body._id}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.canceled).toBe(true);

    const list = await a.agent.get("/api/messages/scheduled");
    expect(list.body.some((s: { _id: string }) => s._id === sched.body._id)).toBe(false);
  });
});

describe("pinned conversations", () => {
  it("toggles pin state and surfaces it on the conversation list", async () => {
    const a = await makeUser("pina");
    const b = await makeUser("pinb");
    // create a DM by sending a message
    const sent = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    const convId = sent.body.conversationId as string;

    const on = await a.agent.post(`/api/messages/conversation/${convId}/pin`);
    expect(on.body.isPinned).toBe(true);

    const list = await a.agent.get("/api/messages/conversations");
    expect(list.body.find((c: { _id: string }) => c._id === convId)?.isPinned).toBe(true);

    const off = await a.agent.post(`/api/messages/conversation/${convId}/pin`);
    expect(off.body.isPinned).toBe(false);
  });
});
