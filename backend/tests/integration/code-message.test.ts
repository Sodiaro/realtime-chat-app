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
    email: `code_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `cd${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("code messages", () => {
  it("sends a code snippet in a DM with language + filename", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      code: { language: "ts", content: "export const x = 1\n", filename: "x.ts" },
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toEqual({ language: "ts", content: "export const x = 1\n", filename: "x.ts" });
  });

  it("coerces an unknown language to plaintext and strips path separators from the filename", async () => {
    const a = await makeUser("c");
    const b = await makeUser("d");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      code: { language: "klingon", content: "hello", filename: "../../etc/passwd" },
    });
    expect(res.status).toBe(201);
    expect(res.body.code.language).toBe("plaintext");
    expect(res.body.code.filename).toBe("....etcpasswd"); // slashes removed
  });

  it("rejects an oversized snippet (>20KB)", async () => {
    const a = await makeUser("e");
    const b = await makeUser("f");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      code: { language: "js", content: "x".repeat(20 * 1024 + 1) },
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty code message with no other content", async () => {
    const a = await makeUser("g");
    const b = await makeUser("h");
    const res = await a.agent.post(`/api/messages/send/${b.id}`).send({
      code: { language: "js", content: "   " },
    });
    expect(res.status).toBe(400);
  });

  it("sends a code snippet to a group conversation", async () => {
    const owner = await makeUser("i");
    const m = await makeUser("j");
    const group = await owner.agent.post("/api/messages/group").send({ name: `CG${Date.now()}`, members: [m.id] });
    const gid = group.body._id as string;

    const res = await owner.agent.post(`/api/messages/conversation/${gid}`).send({
      code: { language: "python", content: "print('hi')\n" },
    });
    expect(res.status).toBe(201);
    expect(res.body.code.language).toBe("python");
    expect(res.body.code.content).toBe("print('hi')\n");
  });
});
