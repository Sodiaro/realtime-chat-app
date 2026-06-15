import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/pic" }) } },
}));

import { app } from "../../src/app";

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `User ${tag}`,
    email: `user_${tag}_${Date.now()}@test.com`,
    password: "secret123",
  });
  return { agent, id: res.body._id as string };
}

describe("profile", () => {
  it("updates username, bio and status", async () => {
    const a = await makeUser("pa");
    const res = await a.agent
      .put("/api/auth/update-profile")
      .send({ username: "Alice_99", bio: "hello", status: "busy" });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("alice_99"); // lowercased
    expect(res.body.bio).toBe("hello");
    expect(res.body.status).toBe("busy");
    expect(res.body.password).toBeUndefined();
  });

  it("rejects a username already taken", async () => {
    const a = await makeUser("pb");
    const b = await makeUser("pc");
    await a.agent.put("/api/auth/update-profile").send({ username: "takenname" });
    const res = await b.agent.put("/api/auth/update-profile").send({ username: "takenname" });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid username", async () => {
    const a = await makeUser("pd");
    const res = await a.agent.put("/api/auth/update-profile").send({ username: "no" });
    expect(res.status).toBe(400);
  });
});
