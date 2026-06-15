import { describe, it, expect } from "vitest";
import request from "supertest";
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

describe("mute & archive", () => {
  it("toggles mute and archive on a conversation", async () => {
    const a = await makeUser("ma");
    const b = await makeUser("mb");
    await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "hi" });
    const convs = (await a.agent.get("/api/messages/conversations")).body;
    const dm = convs.find((c: { isGroup: boolean }) => !c.isGroup);

    const mute = await a.agent.post(`/api/messages/conversation/${dm._id}/mute`);
    expect(mute.body.isMuted).toBe(true);
    const arch = await a.agent.post(`/api/messages/conversation/${dm._id}/archive`);
    expect(arch.body.isArchived).toBe(true);
    const unmute = await a.agent.post(`/api/messages/conversation/${dm._id}/mute`);
    expect(unmute.body.isMuted).toBe(false);
  });
});

describe("starred messages", () => {
  it("stars a message and lists it", async () => {
    const a = await makeUser("sta");
    const b = await makeUser("stb");
    const msg = await a.agent.post(`/api/messages/send/${b.id}`).send({ text: "star me" });

    const star = await a.agent.post(`/api/messages/${msg.body._id}/star`);
    expect(star.body.starred).toBe(true);

    const starred = await a.agent.get("/api/messages/starred");
    expect(starred.body.some((m: { text: string }) => m.text === "star me")).toBe(true);

    const unstar = await a.agent.post(`/api/messages/${msg.body._id}/star`);
    expect(unstar.body.starred).toBe(false);
  });
});

describe("group management", () => {
  it("renames, adds/removes members, and leaves (with admin checks)", async () => {
    const a = await makeUser("gma");
    const b = await makeUser("gmb");
    const c = await makeUser("gmc");
    const grp = await a.agent.post("/api/messages/group").send({ name: "Team", members: [b.id] });
    const cid = grp.body._id;

    const rn = await a.agent.patch(`/api/messages/conversation/${cid}`).send({ name: "Renamed" });
    expect(rn.body.name).toBe("Renamed");

    // non-admin can't rename
    const rn2 = await b.agent.patch(`/api/messages/conversation/${cid}`).send({ name: "Nope" });
    expect(rn2.status).toBe(403);

    const add = await a.agent.post(`/api/messages/conversation/${cid}/members`).send({ members: [c.id] });
    expect(add.body.participants.map((p: { _id: string }) => String(p._id)).includes(c.id)).toBe(true);

    const rem = await a.agent.delete(`/api/messages/conversation/${cid}/members/${c.id}`);
    expect(rem.status).toBe(200);

    const leave = await b.agent.post(`/api/messages/conversation/${cid}/leave`);
    expect(leave.status).toBe(200);
  });
});
