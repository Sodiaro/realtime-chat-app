import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import User from "../../src/models/user.model";

describe("login by username", () => {
  it("logs in using a username instead of email", async () => {
    const username = "loginbyname";
    await request(app).post("/api/auth/signup").send({
      fullName: "L",
      email: `l_${Date.now()}@test.com`,
      password: "secret123",
      username,
    });
    const res = await request(app).post("/api/auth/login").send({ email: username, password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(username);
  });
});

describe("email verification", () => {
  async function makeUnverified(otp?: string) {
    const salt = await bcrypt.genSalt(10);
    return User.create({
      fullName: "V",
      email: `v_${Date.now()}_${Math.random()}@test.com`,
      username: `v${Date.now()}${Math.floor(Math.random() * 1000)}`,
      password: await bcrypt.hash("secret123", salt),
      isVerified: false,
      ...(otp
        ? { emailOtp: await bcrypt.hash(otp, salt), emailOtpExpires: new Date(Date.now() + 600000) }
        : {}),
    });
  }

  it("verifies with a valid OTP and rejects a wrong one", async () => {
    const user = await makeUnverified("123456");
    const wrong = await request(app).post("/api/auth/verify-email").send({ email: user.email, otp: "000000" });
    expect(wrong.status).toBe(400);
    const ok = await request(app).post("/api/auth/verify-email").send({ email: user.email, otp: "123456" });
    expect(ok.status).toBe(200);
    expect(String(ok.headers["set-cookie"]?.[0])).toMatch(/jwt=/);
  });

  it("blocks login until the email is verified", async () => {
    const user = await makeUnverified();
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "secret123" });
    expect(res.status).toBe(403);
    expect(res.body.needsVerification).toBe(true);
  });
});
