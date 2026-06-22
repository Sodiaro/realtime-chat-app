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
    email: `co_${tag}_${Date.now()}@test.com`,
    password: "secret123",
    username: `co${Date.now()}${tag}`.slice(0, 18),
  });
  return { agent, id: res.body._id as string };
}

describe("communities", () => {
  it("creates a community with an admins-only announcement channel", async () => {
    const owner = await makeUser("o");
    const res = await owner.agent.post("/api/communities").send({ name: "Acme", description: "the team" });
    expect(res.status).toBe(201);
    expect(res.body.community.name).toBe("Acme");
    expect(res.body.announcement.isAnnouncement).toBe(true);
    expect(res.body.announcement.onlyAdminsCanMessage).toBe(true);

    // it shows up in my communities list with counts
    const list = await owner.agent.get("/api/communities");
    expect(list.body[0].name).toBe("Acme");
    expect(list.body[0].isAdmin).toBe(true);
    expect(list.body[0].memberCount).toBe(1);
  });

  it("members join the community + a la carte groups; non-admins can't create groups", async () => {
    const owner = await makeUser("a");
    const member = await makeUser("b");
    const created = await owner.agent.post("/api/communities").send({ name: "School" });
    const cid = created.body.community._id as string;

    // admin creates two groups
    const g1 = await owner.agent.post(`/api/communities/${cid}/groups`).send({ name: "Group A" });
    const g2 = await owner.agent.post(`/api/communities/${cid}/groups`).send({ name: "Group B" });
    expect(g1.status).toBe(201);
    expect(g1.body.communityId).toBe(cid);

    // outsider can't view before joining
    const denied = await member.agent.get(`/api/communities/${cid}`);
    expect(denied.status).toBe(403);

    // join the community → can now view, and is in the announcement channel
    const join = await member.agent.post(`/api/communities/${cid}/join`);
    expect(join.status).toBe(200);
    const detail = await member.agent.get(`/api/communities/${cid}`);
    expect(detail.status).toBe(200);
    expect(detail.body.groups).toHaveLength(2);
    // a member belongs to some groups, not all — none yet
    expect(detail.body.groups.every((g: { isMember: boolean }) => !g.isMember)).toBe(true);

    // join only Group A
    const jg = await member.agent.post(`/api/communities/${cid}/groups/${g1.body._id}/join`);
    expect(jg.status).toBe(200);
    const after = await member.agent.get(`/api/communities/${cid}`);
    const a = after.body.groups.find((g: { _id: string }) => g._id === g1.body._id);
    const b = after.body.groups.find((g: { _id: string }) => g._id === g2.body._id);
    expect(a.isMember).toBe(true);
    expect(b.isMember).toBe(false);

    // a plain member cannot create groups
    const forbidden = await member.agent.post(`/api/communities/${cid}/groups`).send({ name: "Sneaky" });
    expect(forbidden.status).toBe(403);
  });

  it("enforces unique community names and unique group names within a community", async () => {
    const owner = await makeUser("u");
    const first = await owner.agent.post("/api/communities").send({ name: "UniqueOrg" });
    expect(first.status).toBe(201);
    const cid = first.body.community._id as string;

    // duplicate community name (case-insensitive) is rejected
    const dupCommunity = await owner.agent.post("/api/communities").send({ name: "uniqueorg" });
    expect(dupCommunity.status).toBe(409);

    // first group ok
    const g1 = await owner.agent.post(`/api/communities/${cid}/groups`).send({ name: "Design" });
    expect(g1.status).toBe(201);

    // same name (case-insensitive) inside the same community is rejected
    const g2 = await owner.agent.post(`/api/communities/${cid}/groups`).send({ name: "  design " });
    expect(g2.status).toBe(409);

    // the same group name is fine in a *different* community
    const other = await owner.agent.post("/api/communities").send({ name: "OtherOrg" });
    const g3 = await owner.agent.post(`/api/communities/${other.body.community._id}/groups`).send({ name: "Design" });
    expect(g3.status).toBe(201);
  });

  it("only admins can post in the announcement channel", async () => {
    const owner = await makeUser("p");
    const member = await makeUser("q");
    const created = await owner.agent.post("/api/communities").send({ name: "Org" });
    const cid = created.body.community._id as string;
    const annId = created.body.announcement._id as string;
    await member.agent.post(`/api/communities/${cid}/join`);

    const blocked = await member.agent.post(`/api/messages/conversation/${annId}`).send({ text: "hi all" });
    expect(blocked.status).toBe(403);

    const ok = await owner.agent.post(`/api/messages/conversation/${annId}`).send({ text: "welcome" });
    expect(ok.status).toBe(201);
  });

  it("leaving a community removes you from its conversations", async () => {
    const owner = await makeUser("x");
    const member = await makeUser("y");
    const created = await owner.agent.post("/api/communities").send({ name: "Leavers" });
    const cid = created.body.community._id as string;
    const g = await owner.agent.post(`/api/communities/${cid}/groups`).send({ name: "G" });
    await member.agent.post(`/api/communities/${cid}/join`);
    await member.agent.post(`/api/communities/${cid}/groups/${g.body._id}/join`);

    const leave = await member.agent.post(`/api/communities/${cid}/leave`);
    expect(leave.status).toBe(200);

    // no longer listed, and can't view
    const list = await member.agent.get("/api/communities");
    expect(list.body.find((c: { _id: string }) => c._id === cid)).toBeUndefined();
    const view = await member.agent.get(`/api/communities/${cid}`);
    expect(view.status).toBe(403);
  });

  it("admins can edit a group's description; moderators can manage groups; members can't", async () => {
    const owner = await makeUser("ed");
    const mod = await makeUser("md");
    const plain = await makeUser("pl");
    const created = await owner.agent.post("/api/communities").send({ name: "Roles" });
    const cid = created.body.community._id as string;
    const g = await owner.agent.post(`/api/communities/${cid}/groups`).send({ name: "Alpha" });
    const gid = g.body._id as string;
    await mod.agent.post(`/api/communities/${cid}/join`);
    await plain.agent.post(`/api/communities/${cid}/join`);

    // admin edits the group description
    const edit = await owner.agent.patch(`/api/communities/${cid}/groups/${gid}`).send({ description: "the A team" });
    expect(edit.status).toBe(200);
    expect(edit.body.description).toBe("the A team");

    // a plain member cannot create or edit groups
    expect((await plain.agent.post(`/api/communities/${cid}/groups`).send({ name: "Nope" })).status).toBe(403);
    expect((await plain.agent.patch(`/api/communities/${cid}/groups/${gid}`).send({ description: "x" })).status).toBe(403);

    // promote to moderator → can now create + edit groups
    const promote = await owner.agent.post(`/api/communities/${cid}/role`).send({ userId: mod.id, role: "moderator" });
    expect(promote.status).toBe(200);
    expect((await mod.agent.post(`/api/communities/${cid}/groups`).send({ name: "Beta" })).status).toBe(201);
    expect((await mod.agent.patch(`/api/communities/${cid}/groups/${gid}`).send({ description: "edited by mod" })).status).toBe(200);
  });

  it("won't demote the last admin", async () => {
    const owner = await makeUser("la");
    const created = await owner.agent.post("/api/communities").send({ name: "Solo" });
    const cid = created.body.community._id as string;
    const res = await owner.agent.post(`/api/communities/${cid}/role`).send({ userId: owner.id, role: "member" });
    expect(res.status).toBe(400);
  });

  it("invite links let an outsider preview and join the community", async () => {
    const owner = await makeUser("io");
    const outsider = await makeUser("is");
    const created = await owner.agent.post("/api/communities").send({ name: "Inviters" });
    const cid = created.body.community._id as string;

    const invite = await owner.agent.post(`/api/communities/${cid}/invite`);
    expect(invite.status).toBe(200);
    const code = invite.body.inviteCode as string;
    expect(code).toBeTruthy();

    const preview = await outsider.agent.get(`/api/communities/invite/${code}`);
    expect(preview.body.name).toBe("Inviters");
    expect(preview.body.isMember).toBe(false);

    const join = await outsider.agent.post(`/api/communities/invite/${code}/join`);
    expect(join.status).toBe(200);
    const view = await outsider.agent.get(`/api/communities/${cid}`);
    expect(view.status).toBe(200); // now a member

    // revoking disables the link
    await owner.agent.delete(`/api/communities/${cid}/invite`);
    expect((await outsider.agent.get(`/api/communities/invite/${code}`)).status).toBe(404);
  });

  it("admins can rename the community (uniqueness enforced)", async () => {
    const owner = await makeUser("rn");
    const c1 = await owner.agent.post("/api/communities").send({ name: "First" });
    await owner.agent.post("/api/communities").send({ name: "Second" });
    const cid = c1.body.community._id as string;

    const dup = await owner.agent.patch(`/api/communities/${cid}`).send({ name: "second" });
    expect(dup.status).toBe(409);

    const ok = await owner.agent.patch(`/api/communities/${cid}`).send({ name: "Renamed", description: "now with desc" });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe("Renamed");
  });
});
