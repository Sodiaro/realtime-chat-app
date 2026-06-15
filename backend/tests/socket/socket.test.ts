import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { io as ioc, type Socket } from "socket.io-client";
import type { AddressInfo } from "net";
import { app } from "../../src/app";
import { server, io } from "../../src/lib/socket";
import type { IMessage } from "../../src/models/message.model";

let url: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  // io.close() also closes the underlying http server
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

async function makeUser(tag: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/signup")
    .send({ fullName: tag, email: `${tag}_${Date.now()}@test.com`, password: "secret123" });
  return { agent, id: res.body._id as string, cookie: String(res.headers["set-cookie"]?.[0]) };
}

const connect = (cookie?: string) =>
  ioc(url, { extraHeaders: cookie ? { Cookie: cookie } : {}, reconnection: false });

describe("socket", () => {
  it("rejects a connection with no JWT cookie", async () => {
    const sock = connect();
    const result = await new Promise<string>((resolve) => {
      sock.on("connect", () => resolve("connected"));
      sock.on("connect_error", (e) => resolve("rejected: " + e.message));
    });
    sock.close();
    expect(result).toMatch(/^rejected/);
  });

  it("delivers a sent message to the receiver's socket in real time", async () => {
    const a = await makeUser("sockA");
    const b = await makeUser("sockB");

    const sock: Socket = connect(b.cookie);
    await new Promise<void>((resolve) => sock.on("connect", () => resolve()));

    const received = new Promise<IMessage>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no newMessage in 8s")), 8000);
      sock.on("newMessage", (m: IMessage) => {
        clearTimeout(t);
        resolve(m);
      });
    });

    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "live!" });

    const msg = await received;
    sock.close();
    expect(msg.text).toBe("live!");
    expect(String(msg.senderId)).toBe(a.id);
  });
});
