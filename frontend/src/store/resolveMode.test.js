import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMode, isDevWorkspace } from "./resolveMode.js";

// These cases mirror the backend Dev Mode contract exactly (flag gate → workspace
// override → user default). Run with: `node --test src/store/resolveMode.test.js`.

const ON = { dev_mode: true };
const OFF = { dev_mode: false };
const userOn = { devMode: { enabled: true } };
const userOff = { devMode: { enabled: false } };

test("flag off is a hard kill-switch ⇒ always chat", () => {
  assert.equal(resolveMode(OFF, userOn, { devMode: { enabled: true } }), "chat");
  assert.equal(resolveMode({}, userOn, null), "chat");
  assert.equal(resolveMode(undefined, userOn, null), "chat");
});

test("explicit workspace override beats the user default", () => {
  // workspace ON beats user OFF
  assert.equal(resolveMode(ON, userOff, { devMode: { enabled: true } }), "dev");
  // workspace OFF (explicit chat) beats user ON
  assert.equal(resolveMode(ON, userOn, { devMode: { enabled: false } }), "chat");
});

test("absent workspace override ⇒ inherit the user default", () => {
  assert.equal(resolveMode(ON, userOn, null), "dev");
  assert.equal(resolveMode(ON, userOn, {}), "dev"); // context present but no devMode
  assert.equal(resolveMode(ON, userOff, { devMode: undefined }), "chat");
});

test("missing data defaults to chat", () => {
  assert.equal(resolveMode(ON, null, null), "chat");
  assert.equal(resolveMode(ON, {}, null), "chat"); // user has no devMode
  assert.equal(resolveMode(ON, { devMode: {} }, null), "chat"); // devMode without `enabled`
});

test("non-boolean workspace enabled is ignored ⇒ inherit user default", () => {
  assert.equal(resolveMode(ON, userOn, { devMode: { enabled: "yes" } }), "dev");
  assert.equal(resolveMode(ON, userOff, { devMode: { enabled: 1 } }), "chat");
});

// isDevWorkspace — the Phase 2 gate (group + resolved "dev")
const group = (devMode) => ({ isGroup: true, ...(devMode ? { devMode } : {}) });
const dm = (devMode) => ({ isGroup: false, ...(devMode ? { devMode } : {}) });

test("flag off ⇒ never a dev workspace (Chat Mode preserved)", () => {
  assert.equal(isDevWorkspace(OFF, userOn, group({ enabled: true })), false);
  assert.equal(isDevWorkspace({}, userOn, group({ enabled: true })), false);
});

test("a dev-resolved group is a dev workspace", () => {
  assert.equal(isDevWorkspace(ON, userOff, group({ enabled: true })), true); // workspace override on
  assert.equal(isDevWorkspace(ON, userOn, group()), true); // inherits personal dev
});

test("an explicitly-off group is not a dev workspace", () => {
  assert.equal(isDevWorkspace(ON, userOn, group({ enabled: false })), false);
});

test("a DM is never a dev workspace, even in personal Dev Mode", () => {
  assert.equal(isDevWorkspace(ON, userOn, dm()), false);
  assert.equal(isDevWorkspace(ON, userOn, dm({ enabled: true })), false);
});
