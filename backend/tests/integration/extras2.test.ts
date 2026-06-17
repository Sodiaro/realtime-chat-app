import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `x2_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `x${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("file sharing", () => {
  it("sends a file message", async () => {
    const a = await makeUser("fa");
    const b = await makeUser("fb");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      file: { data: "data:application/pdf;base64,AA", name: "doc.pdf", size: 1234, type: "application/pdf" },
    });
    expect(res.status).toBe(201);
    expect(res.body.file.url).toBe("http://test/media");
    expect(res.body.file.name).toBe("doc.pdf");
  });
});

describe("polls", () => {
  it("creates a poll and records single-choice votes", async () => {
    const a = await makeUser("pa");
    const b = await makeUser("pb");
    const sent = await a.agent
      .post(`/api/messages/send/${b.id}`)
      .send({ poll: { question: "Lunch?", options: ["Pizza", "Sushi"], multiple: false } });
    expect(sent.status).toBe(201);
    expect(sent.body.poll.options.length).toBe(2);

    const v1 = await b.agent.post(`/api/messages/${sent.body._id}/vote`).send({ optionIndex: 0 });
    expect(v1.body.poll.options[0].votes.map(String)).toContain(b.id);

    const v2 = await b.agent.post(`/api/messages/${sent.body._id}/vote`).send({ optionIndex: 1 });
    expect(v2.body.poll.options[0].votes.map(String)).not.toContain(b.id);
    expect(v2.body.poll.options[1].votes.map(String)).toContain(b.id);
  });
});

describe("call history", () => {
  it("logs and lists a call for both parties", async () => {
    const a = await makeUser("ca");
    const b = await makeUser("cb");
    const log = await a.agent
      .post("/api/calls")
      .send({ calleeId: b.id, type: "video", status: "answered", durationSec: 42 });
    expect(log.status).toBe(201);

    const list = await b.agent.get("/api/calls");
    expect(list.body.some((c: { durationSec: number }) => c.durationSec === 42)).toBe(true);
  });
});

describe("status / stories", () => {
  it("creates and lists a text status", async () => {
    const a = await makeUser("sa");
    const create = await a.agent
      .post("/api/status")
      .send({ type: "text", text: "hello world", bgColor: "#16a34a" });
    expect(create.status).toBe(201);

    const groups = await a.agent.get("/api/status");
    expect(
      groups.body.some((g: { statuses: { text: string }[] }) =>
        g.statuses.some((s) => s.text === "hello world")
      )
    ).toBe(true);
  });
});
