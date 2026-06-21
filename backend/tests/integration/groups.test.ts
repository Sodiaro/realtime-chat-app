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
    email: `gp_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `gp${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("group power-ups", () => {
  it("invite links let an outsider preview and join", async () => {
    const owner = await makeUser("o");
    const m1 = await makeUser("m1");
    const outsider = await makeUser("out");

    const group = await owner.agent.post("/api/messages/group").send({ name: "Devs", members: [m1.id] });
    const gid = group.body._id as string;

    // admin creates an invite link
    const invite = await owner.agent.post(`/api/messages/conversation/${gid}/invite`);
    expect(invite.status).toBe(200);
    const code = invite.body.inviteCode as string;
    expect(code).toBeTruthy();

    // outsider previews then joins
    const preview = await outsider.agent.get(`/api/messages/invite/${code}`);
    expect(preview.body.name).toBe("Devs");
    expect(preview.body.isMember).toBe(false);

    const join = await outsider.agent.post(`/api/messages/invite/${code}/join`);
    expect(join.status).toBe(200);
    expect(join.body.participants.map((p: { _id: string }) => p._id)).toContain(outsider.id);

    // revoking disables the link
    await owner.agent.delete(`/api/messages/conversation/${gid}/invite`);
    const gone = await outsider.agent.get(`/api/messages/invite/${code}`);
    expect(gone.status).toBe(404);
  });

  it("only-admins-can-message blocks non-admin posts", async () => {
    const owner = await makeUser("a");
    const member = await makeUser("b");
    const group = await owner.agent.post("/api/messages/group").send({ name: "Locked", members: [member.id] });
    const gid = group.body._id as string;

    await owner.agent.patch(`/api/messages/conversation/${gid}`).send({ onlyAdminsCanMessage: true });

    const blocked = await member.agent.post(`/api/messages/conversation/${gid}`).send({ text: "hi" });
    expect(blocked.status).toBe(403);

    // promote the member → they can post
    await owner.agent.post(`/api/messages/conversation/${gid}/admin`).send({ userId: member.id, makeAdmin: true });
    const ok = await member.agent.post(`/api/messages/conversation/${gid}`).send({ text: "now i can" });
    expect(ok.status).toBe(201);
  });

  it("enforces unique standalone group names on create and rename", async () => {
    const owner = await makeUser("uq");
    const m = await makeUser("uqm");

    const g1 = await owner.agent.post("/api/messages/group").send({ name: "UniqueTeam", members: [m.id] });
    expect(g1.status).toBe(201);

    // duplicate create (case-insensitive / trimmed) is rejected
    const dup = await owner.agent.post("/api/messages/group").send({ name: "  uniqueteam ", members: [m.id] });
    expect(dup.status).toBe(409);

    // renaming another group onto an existing name is rejected
    const g2 = await owner.agent.post("/api/messages/group").send({ name: "OtherTeam", members: [m.id] });
    const clash = await owner.agent.patch(`/api/messages/conversation/${g2.body._id}`).send({ name: "UniqueTeam" });
    expect(clash.status).toBe(409);

    // renaming a group to its own name (no real change) is fine
    const noop = await owner.agent.patch(`/api/messages/conversation/${g2.body._id}`).send({ name: "OtherTeam" });
    expect(noop.status).toBe(200);
  });

  it("records group read receipts when a member opens the chat", async () => {
    const a = await makeUser("ra");
    const b = await makeUser("rb");
    const group = await a.agent.post("/api/messages/group").send({ name: "Read", members: [b.id] });
    const gid = group.body._id as string;

    const sent = await a.agent.post(`/api/messages/conversation/${gid}`).send({ text: "hello team" });
    expect((sent.body.readBy || [])).not.toContain(b.id);

    // b opens the group → marks a's message read
    await b.agent.get(`/api/messages/conversation/${gid}`);

    // a re-opens and sees b in readBy
    const reload = await a.agent.get(`/api/messages/conversation/${gid}`);
    const msg = reload.body.messages.find((m: { _id: string }) => m._id === sent.body._id);
    expect(msg.readBy.map(String)).toContain(b.id);
  });
});
