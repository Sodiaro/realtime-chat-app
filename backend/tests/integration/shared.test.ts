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
    email: `sh_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `sh${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("shared media", () => {
  it("returns photos and files filtered by type, and blocks non-participants", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await makeUser("c");

    // a photo, a file, and a plain text message
    const photo = await a.agent.post(`/api/messages/send/${b.id}`).send({ image: "data:image/png;base64,AA" });
    await a.agent.post(`/api/messages/send/${b.id}`).send({
      file: { data: "data:application/pdf;base64,AA", name: "doc.pdf", size: 10, type: "application/pdf" },
    });
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "just text" });

    const convId = photo.body.conversationId as string;

    const media = await b.agent.get(`/api/messages/conversation/${convId}/shared`).query({ type: "media" });
    expect(media.status).toBe(200);
    expect(media.body.length).toBe(1);
    expect(media.body[0].image).toBe("http://test/media");

    const files = await b.agent.get(`/api/messages/conversation/${convId}/shared`).query({ type: "files" });
    expect(files.body.length).toBe(1);
    expect(files.body[0].file.name).toBe("doc.pdf");

    // an outsider can't read another conversation's media
    const denied = await c.agent.get(`/api/messages/conversation/${convId}/shared`).query({ type: "media" });
    expect(denied.status).toBe(403);
  });
});
