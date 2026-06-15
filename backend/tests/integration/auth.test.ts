import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

const newUser = (n = "") => ({
  fullName: `User ${n}`,
  email: `user${n}_${Date.now()}@test.com`,
  username: `u${Date.now()}${Math.floor(Math.random() * 100000)}`,
  password: "secret123",
});

describe("auth", () => {
  it("signs up, returns the user without the password, and sets a jwt cookie", async () => {
    const res = await request(app).post("/api/auth/signup").send(newUser("a"));
    expect(res.status).toBe(201);
    expect(res.body.password).toBeUndefined();
    expect(String(res.headers["set-cookie"]?.[0])).toMatch(/jwt=/);
  });

  it("rejects a short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ fullName: "x", email: "short@test.com", password: "123" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    const u = newUser("dup");
    await request(app).post("/api/auth/signup").send(u);
    const res = await request(app).post("/api/auth/signup").send(u);
    expect(res.status).toBe(400);
  });

  it("rejects login with a wrong password", async () => {
    const u = newUser("login");
    await request(app).post("/api/auth/signup").send(u);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: u.email, password: "wrongpass" });
    expect(res.status).toBe(400);
  });

  it("blocks /check without a token", async () => {
    const res = await request(app).get("/api/auth/check");
    expect(res.status).toBe(401);
  });

  it("allows /check with the session cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(newUser("check"));
    const res = await agent.get("/api/auth/check");
    expect(res.status).toBe(200);
    expect(res.body._id).toBeDefined();
  });
});
