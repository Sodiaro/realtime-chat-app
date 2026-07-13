import crypto from "crypto";
import { env } from "./env.js";

// Feature-flag registry. Add a key per phase as Dev Mode grows
// (e.g. "code_messages", "threads", "github", "ai").
export type FlagKey = "dev_mode";

// A resolved snapshot of every flag for one user — this is what the client receives.
export type FlagSnapshot = Record<FlagKey, boolean>;

// Rollout rule for a single flag. Pure data with no env access, so the evaluation
// logic below can be unit-tested in isolation against constructed rules.
export interface FlagRule {
  enabled: boolean; // master switch; false ⇒ off for everyone
  allowlist: Set<string>; // userIds with always-on early access
  rolloutPct: number; // 0–100 deterministic gradual rollout
}

const parseCsv = (s?: string): Set<string> =>
  new Set(
    (s ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );

// Env-bound rules, computed once at boot (env is immutable at runtime). This is the
// only place flags touch configuration; everything below is pure.
const RULES: Record<FlagKey, FlagRule> = {
  dev_mode: {
    enabled: env.FEATURE_DEV_MODE,
    allowlist: parseCsv(env.DEV_MODE_ALLOWLIST),
    rolloutPct: env.DEV_MODE_ROLLOUT_PCT,
  },
};

// Stable 0–99 bucket for (flag, user). The same user always lands in the same bucket
// on every node, so rollout membership never flaps and needs no shared state.
// Deterministic and pure.
export function bucket(flag: string, userId: string): number {
  const digest = crypto.createHash("sha1").update(`${flag}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

// Pure evaluator: decide a rule for a user. No env, no I/O — unit-testable in isolation.
// Order: master switch → anonymous → allowlist → percentage bucket.
export function evaluateFlag(rule: FlagRule, flag: string, userId?: string): boolean {
  if (!rule.enabled) return false; // master off ⇒ off for everyone
  if (!userId) return false; // anonymous ⇒ off (rollout is per-user)
  if (rule.allowlist.has(userId)) return true; // explicit early access
  return bucket(flag, userId) < rule.rolloutPct; // gradual rollout
}

// Public API: evaluate a known flag for a user against the env-bound rules.
export function isEnabled(flag: FlagKey, userId?: string): boolean {
  return evaluateFlag(RULES[flag], flag, userId);
}

// Snapshot of every flag for a user — attached to responses / sent to the client.
export function flagsFor(userId?: string): FlagSnapshot {
  return { dev_mode: isEnabled("dev_mode", userId) };
}
