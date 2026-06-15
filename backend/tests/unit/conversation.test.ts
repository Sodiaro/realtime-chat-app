import { describe, it, expect } from "vitest";
import { directKey } from "../../src/models/conversation.model";

describe("directKey", () => {
  it("is order-independent (same key for (a,b) and (b,a))", () => {
    expect(directKey("aaa", "bbb")).toBe(directKey("bbb", "aaa"));
  });

  it("produces distinct keys for distinct pairs", () => {
    expect(directKey("a", "b")).not.toBe(directKey("a", "c"));
  });
});
