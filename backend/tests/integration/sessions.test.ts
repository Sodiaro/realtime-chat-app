import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

// each agent keeps its own cookie jar, i.e. its own device session
async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: `U ${tag}`,
    email: `se_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `se${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string, email: res.body.email as string };
}

describe("device sessions", () => {
  it("lists the current session and marks it current", async () => {
    const a = await makeUser("a");
    const list = await a.agent.get("/api/auth/sessions");
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].current).toBe(true);
  });

  it("revoking a device invalidates that device's token", async () => {
    // log the same account in from two 'devices' (agents)
    const email = `se_two_${Date.now()}@test.com`;
    const username = `setwo${Date.now()}`.slice(0, 18);
    const device1 = request.agent(app);
    await device1.post("/api/auth/signup").send({ fullName: "Two", email, password: "secret123", username });

    const device2 = request.agent(app);
    const login2 = await device2.post("/api/auth/login").send({ email, password: "secret123" });
    expect(login2.status).toBe(200);

    // device1 sees two sessions, finds device2's (the non-current one)
    const sessions = await device1.get("/api/auth/sessions");
    expect(sessions.body.length).toBe(2);
    const other = sessions.body.find((s: { current: boolean }) => !s.current);
    expect(other).toBeTruthy();

    // device1 revokes device2
    const revoke = await device1.delete(`/api/auth/sessions/${other._id}`);
    expect(revoke.status).toBe(200);

    // device2's next authed request is now rejected
    const after = await device2.get("/api/auth/check");
    expect(after.status).toBe(401);

    // device1 still works and now shows a single session
    const mine = await device1.get("/api/auth/sessions");
    expect(mine.status).toBe(200);
    expect(mine.body.length).toBe(1);
    expect(mine.body[0].current).toBe(true);
  });
});
