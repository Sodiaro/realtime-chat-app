import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { io as ioc, type Socket } from "socket.io-client";
import type { AddressInfo } from "net";

// Force dev_mode ON so the admin-only toggle endpoints succeed and emit. (The flag is
// off by default in the test env; the 403 gate is covered in the HTTP tests.)
vi.mock("../../src/middleware/flags.middleware.js", () => ({
  withFlags: (req: any, _res: any, next: any) => {
    req.flags = { dev_mode: true };
    next();
  },
}));

import { app } from "../../src/app";
import { server, io } from "../../src/lib/socket";

let url: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    fullName: tag,
    email: `${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `u${Date.now()}${Math.floor(Math.random() * 100000)}`,
  });
  return { agent, id: res.body._id as string, cookie: String(res.headers["set-cookie"]?.[0]) };
}

const connect = (cookie: string) => ioc(url, { extraHeaders: { Cookie: cookie }, reconnection: false });

const waitFor = (sock: Socket, event: string, ms = 8000) =>
  new Promise<any>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} in ${ms}ms`)), ms);
    sock.on(event, (p: unknown) => {
      clearTimeout(t);
      resolve(p);
    });
  });

describe("workspace:devmode realtime", () => {
  it("notifies group members when an admin toggles Dev Mode", async () => {
    const owner = await makeUser("wsmOwner");
    const member = await makeUser("wsmMember");
    const grp = await owner.agent.post("/api/messages/group").send({ name: `WS${Date.now()}`, members: [member.id] });
    const gid = grp.body._id as string;

    const sock = connect(member.cookie);
    await new Promise<void>((r) => sock.on("connect", () => r()));
    const got = waitFor(sock, "workspace:devmode");

    await owner.agent.patch(`/api/messages/conversation/${gid}/devmode`).send({ enabled: true });

    const payload = await got;
    sock.close();
    expect(payload.scope).toBe("conversation");
    expect(payload.id).toBe(gid);
    expect(payload.devMode.enabled).toBe(true);
    expect(payload.devMode.enabledBy).toBe(owner.id);
    expect(payload.devMode.enabledAt).toBeTruthy();
  });

  it("notifies community members when an admin toggles Dev Mode", async () => {
    const owner = await makeUser("wscOwner");
    const member = await makeUser("wscMember");
    const created = await owner.agent.post("/api/communities").send({ name: `WSC${Date.now()}` });
    const cid = created.body.community._id as string;
    await member.agent.post(`/api/communities/${cid}/join`);

    const sock = connect(member.cookie);
    await new Promise<void>((r) => sock.on("connect", () => r()));
    const got = waitFor(sock, "workspace:devmode");

    await owner.agent.patch(`/api/communities/${cid}/devmode`).send({ enabled: false });

    const payload = await got;
    sock.close();
    expect(payload.scope).toBe("community");
    expect(payload.id).toBe(cid);
    expect(payload.devMode.enabled).toBe(false); // explicit off propagates too
  });
});
