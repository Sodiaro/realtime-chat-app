import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import Conversation from "../../src/models/conversation.model.js";
import Community from "../../src/models/community.model.js";

// Validates the Phase 1 Step 3 schema: the workspace `devMode` field must be
// THREE-STATE (absent ⇒ inherit / {enabled:true} ⇒ dev / {enabled:false} ⇒ chat)
// and must never auto-populate, so legacy documents keep working unchanged.

const oid = () => new mongoose.Types.ObjectId();

async function makeGroup(suffix: string) {
  return Conversation.create({
    key: `grp_${suffix}_${Date.now()}`,
    participants: [oid()],
    isGroup: true,
    name: `Group ${suffix}`,
  });
}

describe("Conversation.devMode (workspace override)", () => {
  it("is ABSENT on a freshly created group (no auto-population)", async () => {
    const conv = await makeGroup("absent");
    expect(conv.devMode).toBeUndefined(); // in-memory
    const reloaded = await Conversation.findById(conv._id);
    expect(reloaded!.devMode).toBeUndefined(); // round-tripped through Mongo
  });

  it("persists an explicit { enabled: true } with audit fields", async () => {
    const conv = await makeGroup("on");
    const by = oid();
    const at = new Date();
    conv.devMode = { enabled: true, enabledBy: by, enabledAt: at };
    await conv.save();

    const r = await Conversation.findById(conv._id);
    expect(r!.devMode).toBeDefined();
    expect(r!.devMode!.enabled).toBe(true);
    expect(String(r!.devMode!.enabledBy)).toBe(String(by));
    expect(r!.devMode!.enabledAt).toBeInstanceOf(Date);
  });

  it("stores an explicit { enabled: false } as a PRESENT object (distinct from absent)", async () => {
    const conv = await makeGroup("off");
    conv.devMode = { enabled: false };
    await conv.save();

    const r = await Conversation.findById(conv._id);
    expect(r!.devMode).toBeDefined(); // not undefined → 'explicitly off' ≠ 'inherit'
    expect(r!.devMode!.enabled).toBe(false);
  });

  it("treats a legacy doc (inserted with no devMode key) as absent", async () => {
    // bypass the schema to simulate a document written before this field existed
    const { insertedId } = await Conversation.collection.insertOne({
      key: `legacy_${Date.now()}`,
      participants: [oid()],
      isGroup: true,
      name: "Legacy Group",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const loaded = await Conversation.findById(insertedId);
    expect(loaded).toBeTruthy();
    expect(loaded!.devMode).toBeUndefined();
  });
});

describe("Community.devMode (workspace override)", () => {
  it("is ABSENT on a freshly created community", async () => {
    const comm = await Community.create({
      name: `Comm ${Date.now()}`,
      announcementId: oid(),
    });
    expect(comm.devMode).toBeUndefined();
    const reloaded = await Community.findById(comm._id);
    expect(reloaded!.devMode).toBeUndefined();
  });

  it("persists an explicit override and keeps it distinct from absent", async () => {
    const comm = await Community.create({
      name: `Comm2 ${Date.now()}`,
      announcementId: oid(),
    });
    comm.devMode = { enabled: true, enabledBy: oid(), enabledAt: new Date() };
    await comm.save();

    const r = await Community.findById(comm._id);
    expect(r!.devMode!.enabled).toBe(true);
  });
});
