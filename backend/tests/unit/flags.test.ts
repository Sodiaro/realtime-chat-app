import { describe, it, expect } from "vitest";
import {
  bucket,
  evaluateFlag,
  isEnabled,
  flagsFor,
  type FlagRule,
} from "../../src/lib/flags";

// Build a rule with sensible defaults (master on, no allowlist, 0% rollout) and
// override only what each test cares about.
const rule = (over: Partial<FlagRule> = {}): FlagRule => ({
  enabled: true,
  allowlist: new Set<string>(),
  rolloutPct: 0,
  ...over,
});

describe("bucket", () => {
  it("is deterministic for the same (flag, user)", () => {
    expect(bucket("dev_mode", "user-1")).toBe(bucket("dev_mode", "user-1"));
  });

  it("always falls within 0–99", () => {
    for (const id of ["a", "b", "c", "user-1", "x".repeat(40)]) {
      const b = bucket("dev_mode", id);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });
});

describe("evaluateFlag", () => {
  it("is off when the master switch is off (even if allowlisted at 100%)", () => {
    const r = rule({ enabled: false, allowlist: new Set(["u"]), rolloutPct: 100 });
    expect(evaluateFlag(r, "dev_mode", "u")).toBe(false);
  });

  it("is off for anonymous users regardless of rollout", () => {
    expect(evaluateFlag(rule({ rolloutPct: 100 }), "dev_mode", undefined)).toBe(false);
  });

  it("is on for allowlisted users even at 0% rollout", () => {
    expect(evaluateFlag(rule({ allowlist: new Set(["vip"]) }), "dev_mode", "vip")).toBe(true);
  });

  it("0% rollout is off for every non-allowlisted user", () => {
    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(evaluateFlag(rule({ rolloutPct: 0 }), "dev_mode", id)).toBe(false);
    }
  });

  it("100% rollout is on for every authenticated user", () => {
    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(evaluateFlag(rule({ rolloutPct: 100 }), "dev_mode", id)).toBe(true);
    }
  });

  it("respects the user's bucket boundary deterministically", () => {
    const id = "boundary-user";
    const b = bucket("dev_mode", id);
    // pct just above the user's bucket includes them; at/below excludes them
    expect(evaluateFlag(rule({ rolloutPct: b + 1 }), "dev_mode", id)).toBe(true);
    expect(evaluateFlag(rule({ rolloutPct: b }), "dev_mode", id)).toBe(false);
  });

  it("~50% rollout includes roughly half of users (gradual, not all-or-nothing)", () => {
    const N = 1000;
    let on = 0;
    for (let i = 0; i < N; i++) {
      if (evaluateFlag(rule({ rolloutPct: 50 }), "dev_mode", `user-${i}`)) on++;
    }
    // Deterministic hash → stable every run. Loose bounds guard against
    // all-on/all-off regressions in the bucketing math.
    expect(on).toBeGreaterThan(N * 0.4);
    expect(on).toBeLessThan(N * 0.6);
  });
});

describe("isEnabled / flagsFor (env-bound, default test config)", () => {
  // No FEATURE_DEV_MODE / DEV_MODE_* set in vitest.config.ts ⇒ flag off by default.
  it("dev_mode is OFF by default", () => {
    expect(isEnabled("dev_mode", "anyone")).toBe(false);
  });

  it("flagsFor returns an all-false snapshot by default", () => {
    expect(flagsFor("anyone")).toEqual({ dev_mode: false });
  });
});
