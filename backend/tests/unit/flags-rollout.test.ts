import { describe, it, expect } from "vitest";
import { evaluateFlag, isEnabled, flagsFor, type FlagRule } from "../../src/lib/flags";

// Explicit validation of the four documented rollout modes (Phase 1 readiness):
// OFF → allowlist → partial → full. Uses the pure evaluator against constructed rules
// (the env-bound default in the test env is OFF, validated below).

const rule = (over: Partial<FlagRule> = {}): FlagRule => ({
  enabled: true,
  allowlist: new Set<string>(),
  rolloutPct: 0,
  ...over,
});
const USERS = Array.from({ length: 500 }, (_, i) => `user-${i}`);

describe("Dev Mode rollout scenarios", () => {
  // 1) FEATURE FLAG OFF — master kill-switch overrides everything
  describe("feature flag OFF", () => {
    it("is off for everyone, even allowlisted users at 100% rollout", () => {
      const r = rule({ enabled: false, allowlist: new Set(USERS), rolloutPct: 100 });
      for (const u of USERS) expect(evaluateFlag(r, "dev_mode", u)).toBe(false);
    });
    it("the env-bound default (test env, no FEATURE_DEV_MODE) reports off", () => {
      expect(isEnabled("dev_mode", "anyone")).toBe(false);
      expect(flagsFor("anyone")).toEqual({ dev_mode: false });
    });
  });

  // 2) ALLOWLIST MODE — exactly the listed users, independent of rollout %
  describe("allowlist mode", () => {
    const r = rule({ allowlist: new Set(["alice", "bob"]), rolloutPct: 0 });
    it("enables exactly the allowlisted users", () => {
      expect(evaluateFlag(r, "dev_mode", "alice")).toBe(true);
      expect(evaluateFlag(r, "dev_mode", "bob")).toBe(true);
    });
    it("leaves everyone else off at 0% rollout", () => {
      for (const u of USERS) expect(evaluateFlag(r, "dev_mode", u)).toBe(false);
    });
  });

  // 3) PARTIAL ROLLOUT — a stable, deterministic ~pct% subset that grows monotonically
  describe("partial rollout", () => {
    it("includes roughly the configured percentage of users", () => {
      const on = USERS.filter((u) => evaluateFlag(rule({ rolloutPct: 50 }), "dev_mode", u));
      expect(on.length).toBeGreaterThan(USERS.length * 0.4);
      expect(on.length).toBeLessThan(USERS.length * 0.6);
    });
    it("membership is stable across repeated evaluations (no flapping)", () => {
      const r = rule({ rolloutPct: 50 });
      for (const u of USERS) {
        expect(evaluateFlag(r, "dev_mode", u)).toBe(evaluateFlag(r, "dev_mode", u));
      }
    });
    it("raising the percentage only adds users (monotonic — safe to ramp)", () => {
      const at30 = USERS.filter((u) => evaluateFlag(rule({ rolloutPct: 30 }), "dev_mode", u));
      const at60 = new Set(USERS.filter((u) => evaluateFlag(rule({ rolloutPct: 60 }), "dev_mode", u)));
      for (const u of at30) expect(at60.has(u)).toBe(true);
    });
  });

  // 4) FULL ROLLOUT — 100% means every authenticated user; anonymous still excluded
  describe("full rollout", () => {
    const r = rule({ rolloutPct: 100 });
    it("enables every authenticated user", () => {
      for (const u of USERS) expect(evaluateFlag(r, "dev_mode", u)).toBe(true);
    });
    it("still excludes anonymous requests (no userId)", () => {
      expect(evaluateFlag(r, "dev_mode", undefined)).toBe(false);
    });
  });
});
