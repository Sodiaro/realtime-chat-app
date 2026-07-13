import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTIONS,
  DEFAULT_SECTION_ID,
  isValidSection,
  resolveSectionId,
  getSection,
} from "./sectionRegistry.js";

test("has the five Phase 2 sections in order, Discussions first", () => {
  assert.deepEqual(
    SECTIONS.map((s) => s.id),
    ["discussions", "repositories", "documentation", "issues", "activity"]
  );
  assert.equal(SECTIONS[0].id, DEFAULT_SECTION_ID);
});

test("Discussions is the chat section; the rest are expandable modules", () => {
  assert.equal(SECTIONS[0].kind, "chat");
  for (const s of SECTIONS.slice(1)) assert.equal(s.kind, "module");
});

test("every section has a label and an icon, and ids are unique", () => {
  for (const s of SECTIONS) {
    assert.ok(s.label, `${s.id} missing label`);
    assert.ok(s.icon, `${s.id} missing icon`);
  }
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length);
});

test("isValidSection recognises known ids only", () => {
  assert.equal(isValidSection("issues"), true);
  assert.equal(isValidSection("nope"), false);
  assert.equal(isValidSection(undefined), false);
});

test("resolveSectionId defaults unknown/missing ids to Discussions", () => {
  assert.equal(resolveSectionId("repositories"), "repositories");
  assert.equal(resolveSectionId("bogus"), DEFAULT_SECTION_ID);
  assert.equal(resolveSectionId(undefined), DEFAULT_SECTION_ID);
  assert.equal(resolveSectionId(""), DEFAULT_SECTION_ID);
});

test("getSection returns the section object (or the default) ", () => {
  assert.equal(getSection("activity").label, "Activity");
  assert.equal(getSection("bogus").id, DEFAULT_SECTION_ID);
});
