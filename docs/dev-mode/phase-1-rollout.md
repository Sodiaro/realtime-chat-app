# Phase 1 — Dev Mode Rollout Runbook

Operational guide for shipping the **Dev Mode** foundation. Everything is gated by the
`dev_mode` feature flag; with the flag off the app is byte-for-byte the current
WhatsApp-style experience.

## 1. Flag configuration (env)

Set on the **backend** (`backend/.env` / deploy env). All optional; defaults = off.

| Var | Default | Meaning |
|---|---|---|
| `FEATURE_DEV_MODE` | `false` | Master kill-switch. `false` ⇒ off for everyone, regardless of the two below. |
| `DEV_MODE_ALLOWLIST` | _(empty)_ | CSV of userIds with always-on early access (bypasses the percentage). |
| `DEV_MODE_ROLLOUT_PCT` | `0` | Deterministic gradual rollout, `0`–`100` (% of users). |

> Booleans are parsed strictly: only `1/true/yes/on` are truthy. `FEATURE_DEV_MODE=false`
> really is off (we do **not** use `z.coerce.boolean()`, which would treat `"false"` as true).

Resolution per user (server `flagsFor` → `isEnabled`): master off ⇒ off; else allowlisted ⇒ on;
else `sha1("dev_mode:<userId>") % 100 < DEV_MODE_ROLLOUT_PCT`. The bucket is stable per user,
so membership never flaps and ramps are **monotonic** (raising the % only ever adds users).

## 2. The four rollout modes

| Mode | Env | Who gets Dev Mode |
|---|---|---|
| **OFF** (default) | `FEATURE_DEV_MODE=false` | nobody — app unchanged |
| **Allowlist** (internal dogfood) | `FEATURE_DEV_MODE=true`, `DEV_MODE_ALLOWLIST=<ids>`, `DEV_MODE_ROLLOUT_PCT=0` | only listed users |
| **Partial** (canary/ramp) | `FEATURE_DEV_MODE=true`, `DEV_MODE_ROLLOUT_PCT=5→25→50` | stable ~N% + allowlist |
| **Full** (GA) | `FEATURE_DEV_MODE=true`, `DEV_MODE_ROLLOUT_PCT=100` | every authenticated user |

Each mode is validated by automated tests — see §5.

## 3. Deployment checklist

**Pre-flight**
- [ ] CI green, incl. the flag-OFF regression suites (`*-flag-off.test.ts`).
- [ ] Swagger reflects the new shapes/paths (`/auth/check` flags, `/auth/devmode`, the two workspace PATCHes, `User.devMode`, `Conversation.devMode`).
- [ ] Env vars present on the target (defaults keep it OFF).

**Deploy (flag OFF)**
- [ ] Ship backend + frontend with `FEATURE_DEV_MODE=false`.
- [ ] Verify `GET /auth/check` returns `flags.dev_mode:false`; no Dev UI renders; messaging unchanged.
- [ ] `/health` 200, `/ready` 200, `/metrics` scrapes (now exposes `devmode_toggles_total`).

**Dogfood (allowlist)**
- [ ] `DEV_MODE_ALLOWLIST=<team userIds>`, restart. Allowlisted users see the rail/Settings toggles.
- [ ] Toggle personal + group/community Dev Mode; confirm realtime `workspace:devmode` reaches other members; confirm non-admins get 403 and a disabled toggle.
- [ ] Confirm Chat Mode users in the same group are unaffected.

**Ramp**
- [ ] `DEV_MODE_ROLLOUT_PCT` 5 → 25 → 50 → 100, watching the dashboards in §6 between steps.

**GA**
- [ ] `DEV_MODE_ROLLOUT_PCT=100` (document `FEATURE_DEV_MODE=true` as default-on for new deploys).

## 4. Rollback (fastest first)

1. **Kill switch (seconds, no deploy):** `FEATURE_DEV_MODE=false` (or `DEV_MODE_ROLLOUT_PCT=0` + clear allowlist), rolling-restart. All clients re-resolve to Chat Mode on the next `/auth/check`; server re-checks reject writes (`403`). Data is retained, inert.
2. **Code rollback (one deploy):** revert the Phase 1 PR(s). The optional schema fields become orphaned but harmless (ignored).
3. **Data cleanup (only if ever desired):** an idempotent `$unset` of `user.devMode` / `*.devMode`. Not required for rollback correctness.

Because the feature is additive and flag-gated, **rollback never touches the existing messaging paths.**

## 5. Validation matrix (scenario → test)

| Scenario | Test |
|---|---|
| Flag OFF (incl. allowlisted-but-master-off) | `tests/unit/flags-rollout.test.ts` › feature flag OFF; `flags.test.ts` |
| Allowlist mode | `flags-rollout.test.ts` › allowlist mode |
| Partial rollout (stable %, no flapping, monotonic ramp) | `flags-rollout.test.ts` › partial rollout |
| Full rollout (100%, anon excluded) | `flags-rollout.test.ts` › full rollout |
| Endpoints gated by flag (403 when off) | `devmode-flag-off.test.ts`, `workspace-devmode-flag-off.test.ts` |
| Endpoints work when flag on | `devmode.test.ts`, `workspace-devmode.test.ts` |
| Realtime broadcast | `tests/socket/workspace-devmode.socket.test.ts` |
| Backward-compat / 3-state schema | `workspace-devmode-schema.test.ts` |
| Client/server mode parity | `frontend/src/store/resolveMode.test.js` |

## 6. Observability

**Metrics** (`/metrics`, Prometheus): `devmode_toggles_total{scope,value}` — `scope ∈ {user,conversation,community}`, `value ∈ {on,off}`. Use for adoption curves and to confirm a ramp is taking effect. Existing `http_requests_total{route,status_code}` covers the new routes (watch for `403`/`5xx` on `/auth/devmode` and the workspace PATCHes).

**Logs** (Pino, structured, correlation-id tagged): `"devmode preference updated"` (`userId`, `enabled`, `defaultForNewWorkspaces`) and `"workspace devmode toggle"` (`userId`, `conversationId`/`communityId`, `enabled`). `enabledBy`/`enabledAt` are also persisted on the workspace doc for audit.

**Suggested alerts during ramp:** error-rate spike on `/api/auth/devmode` or `/api/messages/conversation/*/devmode`; `/auth/check` latency regression; socket connection drop.

## 7. Multi-node note

Flag evaluation is stateless (hash of `dev_mode:<userId>` vs env), so it's identical on every
node with no coordination. The `workspace:devmode` broadcast targets per-user rooms, so it rides
the existing Socket.IO **Redis adapter** (`REDIS_URL`) across nodes automatically.
