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
    email: `x4_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `x4${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("location sharing", () => {
  it("sends a location message", async () => {
    const a = await makeUser("la");
    const b = await makeUser("lb");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      location: { lat: 6.5244, lng: 3.3792, label: "Lagos" },
    });
    expect(res.status).toBe(201);
    expect(res.body.location.lat).toBeCloseTo(6.5244);
    expect(res.body.location.lng).toBeCloseTo(3.3792);
    expect(res.body.location.label).toBe("Lagos");
  });

  it("rejects an out-of-range location with no other content", async () => {
    const a = await makeUser("lc");
    const b = await makeUser("ld");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      location: { lat: 999, lng: 999 },
    });
    expect(res.status).toBe(400);
  });
});

describe("contact sharing", () => {
  it("sends a contact card", async () => {
    const a = await makeUser("ka");
    const b = await makeUser("kb");
    const c = await makeUser("kc");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      contact: { userId: c.id, name: "Carol", username: "carol" },
    });
    expect(res.status).toBe(201);
    expect(res.body.contact.name).toBe("Carol");
    expect(String(res.body.contact.userId)).toBe(c.id);
  });

  it("rejects a contact with no name", async () => {
    const a = await makeUser("ke");
    const b = await makeUser("kf");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({ contact: { username: "x" } });
    expect(res.status).toBe(400);
  });
});
