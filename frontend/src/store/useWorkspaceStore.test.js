import { test } from "node:test";
import assert from "node:assert/strict";
import { useWorkspaceStore } from "./useWorkspaceStore.js";

// localStorage is absent under node:test; the store's read/write are guarded, so
// persistence is a no-op here and we exercise the in-memory resolution logic.

test("defaults unknown workspaces to Discussions", () => {
  assert.equal(useWorkspaceStore.getState().getActiveSection("nope"), "discussions");
});

test("remembers the active section independently per workspace", () => {
  useWorkspaceStore.getState().setActiveSection("w1", "repositories");
  useWorkspaceStore.getState().setActiveSection("w2", "issues");
  assert.equal(useWorkspaceStore.getState().getActiveSection("w1"), "repositories");
  assert.equal(useWorkspaceStore.getState().getActiveSection("w2"), "issues");
});

test("invalid section ids fall back to Discussions", () => {
  useWorkspaceStore.getState().setActiveSection("w3", "bogus");
  assert.equal(useWorkspaceStore.getState().getActiveSection("w3"), "discussions");
});
