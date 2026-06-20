import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: vi.fn().mockResolvedValue({ secure_url: "http://test/media" }) } },
}));

import { app } from "../../src/app";

async function signup(email: string) {
  const agent = request.agent(app);
  const username = `r${Date.now()}${Math.random().toString(36).slice(2, 6)}`.slice(0, 18);
  await agent.post("/api/auth/signup").send({ fullName: "R", email, password: "secret123", username });
  return { agent, username };
}

describe("forgot / reset password", () => {
  it("resets the password with the emailed code", async () => {
    const email = `rs_${Date.now()}@test.com`;
    await signup(email);

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(forgot.status).toBe(200);
    const otp = forgot.body.devOtp as string;
    expect(otp).toBeTruthy();

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "newsecret456" });
    expect(reset.status).toBe(200);

    // old password no longer works, new one does
    const oldLogin = await request(app).post("/api/auth/login").send({ email, password: "secret123" });
    expect(oldLogin.status).toBe(400);
    const newLogin = await request(app).post("/api/auth/login").send({ email, password: "newsecret456" });
    expect(newLogin.status).toBe(200);
  });

  it("resets by username too (code still goes to the account email)", async () => {
    const email = `rsu_${Date.now()}@test.com`;
    const { username } = await signup(email);

    // request + reset using the USERNAME as the identifier
    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: username });
    expect(forgot.status).toBe(200);
    const otp = forgot.body.devOtp as string;
    expect(otp).toBeTruthy();

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: username, otp, newPassword: "viausername9" });
    expect(reset.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email, password: "viausername9" });
    expect(login.status).toBe(200);
  });

  it("rejects an invalid code", async () => {
    const email = `rs2_${Date.now()}@test.com`;
    await signup(email);
    await request(app).post("/api/auth/forgot-password").send({ email });
    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp: "000000", newPassword: "whatever123" });
    expect(reset.status).toBe(400);
  });

  it("locks the code after too many wrong attempts", async () => {
    const email = `rl_${Date.now()}@test.com`;
    await signup(email);
    const forgot = await request(app).post("/api/auth/forgot-password").send({ email });
    const otp = forgot.body.devOtp as string;

    // 5 wrong tries ("000000" is never a valid 6-digit code from randomInt(100000,…))
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post("/api/auth/reset-password")
        .send({ email, otp: "000000", newPassword: "whatever123" });
      expect(r.status).toBe(400);
    }
    // the code is now invalidated — even the correct one is rejected
    const final = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "whatever123" });
    expect(final.status).toBe(400);
  });

  it("gives a generic 200 for an unknown email (no account enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: `nobody_${Date.now()}@test.com` });
    expect(res.status).toBe(200);
    expect(res.body.devOtp).toBeUndefined();
  });
});
