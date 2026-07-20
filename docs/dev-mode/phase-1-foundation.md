# Phase 1 — Foundation & Mode System

**Status:** Implemented
**Owner:** Platform
**Feature flag:** `dev_mode`
**Goal:** Introduce **Dev Mode** as an additive, flag-gated layer over the existing
WhatsApp-style experience — _without changing Chat Mode behavior_ — and lay the
extensible feature-flag + mode plumbing that Phases 2–9 build on.

> **Scope discipline.** Phase 1 ships **no new developer tools**. It ships only:
> (a) a feature-flag system, (b) a two-level Dev Mode preference (user + workspace),
> (c) the state/plumbing to resolve and broadcast "what mode am I in here", and
> (d) the UI affordances to toggle it. Sidebar sections, code messages, threads,
> etc. are **Phase 2+** and are intentionally stubbed as "coming soon" surfaces.

---

## 0. Where this plugs into the existing codebase

Grounding the design in what already exists (no rewrites):

| Concern | Existing asset | Phase 1 change |
|---|---|---|
| Env / config | [`backend/src/lib/env.ts`](../../backend/src/lib/env.ts) (Zod) | Add 3 optional flag vars |
| Feature flags | _none_ — today flags are "is the env var present?" (Redis, VAPID) | Add first-class `lib/flags.ts` + `req.flags` middleware |
| User prefs | `user.model.ts` + `updatePrivacy` in [`auth.controller.ts`](../../backend/src/controllers/auth.controller.ts) | Add `user.devMode`, mirror the privacy endpoint pattern |
| Workspaces | `conversation.model.ts` (groups), `community.model.ts` | Add optional `devMode` sub-doc to each |
| Realtime | [`backend/src/lib/socket.ts`](../../backend/src/lib/socket.ts) (Socket.IO rooms) | One new event: `workspace:devmode` |
| API docs | `backend/src/lib/swagger.js` | Add new paths/schemas (per repo memory: keep in sync) |
| Client auth state | `useAuthStore.js` (`authUser` source of truth) | Mirror `updatePrivacy` → `setDevMode` |
| Client prefs | `usePrefsStore.js` (localStorage) | New `useDevModeStore.js` (resolves mode) |
| Layout | `App.jsx`, `LeftRail.jsx`, `ChatHeader.jsx`, `SettingsPage.jsx` | Add toggles + a `data-mode` body attribute |

**Two levels of Dev Mode** (this is the core mental model):

- **User preference** (`user.devMode.enabled`) — _my personal default_. Applies to
  DMs and Notes, and is the default I get in any workspace that hasn't set its own.
- **Workspace override** (`conversation.devMode.enabled` / `community.devMode.enabled`)
  — _this group/community is a dev workspace_. Admin-controlled, broadcast to all
  members. Overrides the personal default for that workspace.

A "**workspace**" = a **group conversation** or a **community**. DMs/Notes are not
workspaces; they follow the user preference only.

---

## 1. Architecture

### 1.1 Mode resolution (the central rule)

`resolveMode(viewer, context)` is a **pure function** that both client and server
agree on. It is the only place "are we in Dev Mode?" is decided.

```
                 ┌─────────────────────────────────────────────┐
                 │            resolveMode(viewer, ctx)          │
                 └─────────────────────────────────────────────┘
                                    │
   1. flag gate ──────────────────► if flags.dev_mode is OFF for viewer → "chat"
                                    │   (hard kill-switch; nothing else matters)
                                    ▼
   2. workspace override ─────────► if ctx is a group/community AND
                                    │   ctx.devMode.enabled === true  → "dev"
                                    │   ctx.devMode.enabled === false → "chat"
                                    ▼   (explicit per-workspace decision wins)
   3. user default ───────────────► else → viewer.devMode.enabled ? "dev" : "chat"
```

Properties:
- **Fail-safe:** flag off ⇒ always Chat Mode ⇒ existing UX is untouched.
- **Deterministic:** same inputs → same mode on server and client (no drift).
- **Composable:** Phases 2–9 read the resolved mode; they never re-implement the rule.

### 1.2 Request/realtime flow

```
  ┌────────────┐   GET /auth/check         ┌─────────────────────────────┐
  │  Browser   │ ────────────────────────► │  Express                    │
  │  (Zustand) │                           │   protectRoute → req.user   │
  │            │ ◄──────────────────────── │   withFlags   → req.flags   │
  │            │   { ...user, devMode,     │   checkAuth returns user +  │
  │            │     flags:{dev_mode} }    │   flags snapshot            │
  └────────────┘                           └─────────────────────────────┘
        │  user toggles workspace Dev Mode (admin)                  │
        │  PATCH /messages/conversations/:id/devmode                ▼
        │ ─────────────────────────────────────────────►  update Conversation.devMode
        │                                                  io.to(roomOf(convId))
        │ ◄───────────────  socket "workspace:devmode"  ── .emit(...) to all members
        ▼
  useDevModeStore patches the conversation in useChatStore → UI re-resolves mode
```

### 1.3 Module diagram (new + touched)

```
backend/src/
  lib/
    flags.ts            ★ NEW  flag definitions + evaluate(userId, flag)
    env.ts              ✎ add FEATURE_DEV_MODE, DEV_MODE_ALLOWLIST, DEV_MODE_ROLLOUT_PCT
    socket.ts           ✎ helper to emit workspace:devmode to a conversation room
  middleware/
    flags.middleware.ts ★ NEW  attaches req.flags (cheap, per-request snapshot)
  models/
    user.model.ts       ✎ + devMode { enabled, defaultForNewWorkspaces }
    conversation.model.ts ✎ + devMode { enabled, enabledBy, enabledAt }
    community.model.ts   ✎ + devMode { enabled, enabledBy, enabledAt }
  controllers/
    preferences.controller.ts ★ NEW  setDevMode (user) + flag echo
    message.controller.ts     ✎ setConversationDevMode (workspace, admin-gated)
    community.controller.ts   ✎ setCommunityDevMode (workspace, admin-gated)
  routes/
    auth.route.ts        ✎ POST /auth/devmode
    message.route.ts     ✎ PATCH /conversations/:id/devmode
    community.route.ts   ✎ PATCH /:id/devmode
  lib/swagger.js         ✎ paths + schemas for the above

frontend/src/
  store/
    useDevModeStore.js   ★ NEW  resolveMode(), flags, body data-mode side-effect
    useAuthStore.js      ✎ setDevMode() mirroring updatePrivacy()
    useChatStore.js      ✎ apply workspace:devmode socket patches
  components/
    DevModeToggle.jsx    ★ NEW  shared switch (global + per-workspace variants)
    LeftRail.jsx         ✎ global Dev Mode toggle + active indicator
    ChatHeader.jsx       ✎ per-workspace toggle (admins) / badge (members)
  pages/
    SettingsPage.jsx     ✎ "Developer" section: personal default + flag status
```

---

## 2. Database schema changes

All additions are **optional with defaults** ⇒ existing documents remain valid; no
backfill required (consistent with the repo's existing no-migration stance).

### 2.1 `user.model.ts`

```ts
export interface IDevModePref {
  enabled: boolean;                 // my personal Dev Mode default (DMs/Notes + fallback)
  defaultForNewWorkspaces: boolean; // when I create a group/community, pre-enable Dev Mode
}

export interface IUser {
  // …existing…
  devMode: IDevModePref;
}

// schema
devMode: {
  enabled: { type: Boolean, default: false },
  defaultForNewWorkspaces: { type: Boolean, default: false },
},
```

### 2.2 `conversation.model.ts` (groups are workspaces)

```ts
export interface IWorkspaceDevMode {
  enabled: boolean;
  enabledBy?: Types.ObjectId; // who last toggled it (audit)
  enabledAt?: Date;
}

export interface IConversation {
  // …existing…
  devMode?: IWorkspaceDevMode; // groups only; undefined ⇒ "inherit user default"
}

// schema (sub-doc, _id:false)
devMode: {
  type: new Schema<IWorkspaceDevMode>(
    {
      enabled: { type: Boolean, default: false },
      enabledBy: { type: Schema.Types.ObjectId, ref: "User" },
      enabledAt: { type: Date },
    },
    { _id: false }
  ),
  // intentionally no top-level default → "unset" is meaningful (inherit)
},
```

> **Semantics:** `devMode` **absent/unset** ⇒ inherit the viewer's personal default.
> `devMode.enabled === true|false` ⇒ explicit workspace decision (overrides default).
> This three-state model (unset / on / off) is what lets resolution step 2 work.

### 2.3 `community.model.ts`

Same `IWorkspaceDevMode` sub-doc as 2.2. A community's announcement channel and its
groups inherit the community decision unless the group sets its own (group override
beats community, which beats user default — see §1.1, evaluated most-specific-first).

### 2.4 Index impact

**None.** Dev Mode fields are not queried in hot paths (they're read on documents
already being loaded). No new indexes; no write-amplification on the
`participants/lastMessageAt` or `nameKey` indexes.

---

## 3. Feature-flag system

Today "flags" are implicit (`REDIS_URL` present ⇒ Redis on). Phase 1 introduces a
**small, explicit, extensible** evaluator — enough for safe rollout now, and the
home for every future phase flag (`code_messages`, `threads`, `github`, `ai`, …).

### 3.1 Env additions (`env.ts`)

> **Implemented (Step 1) — corrected from the original draft.** `z.coerce.boolean()`
> is **unusable** for env flags under this repo's Zod v4: it uses JS `Boolean()`
> semantics, so `FEATURE_DEV_MODE=false` (a non-empty string) coerces to `true` and
> the kill-switch can never be turned off. We use an explicit `envBool` helper that
> only accepts `1/true/yes/on`.

```ts
// helper (defined above the schema): accepts only explicit truthy tokens
const TRUTHY = new Set(["1", "true", "yes", "on"]);
const envBool = (def: boolean) =>
  z.preprocess(
    (v) => (typeof v === "string" ? TRUTHY.has(v.trim().toLowerCase()) : def),
    z.boolean()
  );

// schema additions:
FEATURE_DEV_MODE: envBool(false),                          // master switch
DEV_MODE_ALLOWLIST: z.string().optional(),                 // CSV of userIds (early access)
DEV_MODE_ROLLOUT_PCT: z.coerce.number().min(0).max(100).default(0), // % gradual rollout
```

### 3.2 `lib/flags.ts`

> **Implemented (Step 1) — refined from the draft for testability.** The original
> single `isEnabled` closed over the env-bound `RULES`, which can't be exercised in a
> unit test without module-reset hacks. We split a **pure core** (`bucket`,
> `evaluateFlag` — no env, no I/O) from the **env-bound API** (`isEnabled`,
> `flagsFor`). The pure core takes an explicit `FlagRule`, so rollout/allowlist logic
> is tested directly (mirroring the existing `directKey` pure-unit-test pattern).
> Bucketing also reads a full `uint32` instead of one byte for a more uniform spread.

```ts
import crypto from "crypto";
import { env } from "./env.js";

export type FlagKey = "dev_mode"; // extend per phase
export type FlagSnapshot = Record<FlagKey, boolean>;

export interface FlagRule {        // pure data — no env access ⇒ unit-testable
  enabled: boolean;                // master switch
  allowlist: Set<string>;          // always-on userIds
  rolloutPct: number;              // 0–100 deterministic bucket rollout
}

// env-bound rules, computed once at boot (the only place flags touch config)
const RULES: Record<FlagKey, FlagRule> = {
  dev_mode: {
    enabled: env.FEATURE_DEV_MODE,
    allowlist: parseCsv(env.DEV_MODE_ALLOWLIST),
    rolloutPct: env.DEV_MODE_ROLLOUT_PCT,
  },
};

// stable 0–99 bucket per (flag, user): same user always lands in the same bucket — PURE
export function bucket(flag: string, userId: string): number {
  const digest = crypto.createHash("sha1").update(`${flag}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

// PURE evaluator: master off → anonymous → allowlist → percentage
export function evaluateFlag(rule: FlagRule, flag: string, userId?: string): boolean {
  if (!rule.enabled) return false;
  if (!userId) return false;
  if (rule.allowlist.has(userId)) return true;
  return bucket(flag, userId) < rule.rolloutPct;
}

// public API against the env-bound rules
export function isEnabled(flag: FlagKey, userId?: string): boolean {
  return evaluateFlag(RULES[flag], flag, userId);
}

// snapshot of all flags for a user (sent to the client on auth)
export function flagsFor(userId?: string): FlagSnapshot {
  return { dev_mode: isEnabled("dev_mode", userId) };
}
```

Design notes:
- **Deterministic rollout.** SHA1-bucketing means a user’s on/off state is stable
  across requests and nodes (no flapping, multi-node safe — no shared state needed).
- **Override order:** master off → off; else allowlist → on; else percentage. Setting
  `DEV_MODE_ROLLOUT_PCT=100` is "GA". Setting `FEATURE_DEV_MODE=false` is the kill switch.
- **Pure core / env shell.** `evaluateFlag` + `bucket` are pure and exported for tests;
  `isEnabled`/`flagsFor` bind them to env config.
- **Extensible:** future phases add a `FlagKey` + a `RULES` entry; the API, middleware,
  and client store need no structural change.
- **No DB, no network:** evaluation is pure CPU on env-derived config ⇒ zero latency,
  trivially horizontally scalable. (A later phase can swap `RULES` for a cached DB/remote
  config source behind the same `isEnabled` signature.)

### 3.3 `middleware/flags.middleware.ts`

```ts
import type { RequestHandler } from "express";
import { flagsFor } from "../lib/flags.js";

export const withFlags: RequestHandler = (req, _res, next) => {
  req.flags = flagsFor(req.user ? String(req.user._id) : undefined);
  next();
};
```

`req.flags` is typed by **extending the existing** `types/augment.d.ts`
(`flags?: FlagSnapshot`, imported from `lib/flags.ts`) — the same file that already
augments `req.user`/`req.sessionId`.

> **Step 1 boundary:** `withFlags` is **implemented but not yet mounted**. Nothing
> reads `req.flags` until the Dev Mode endpoints exist, so mounting is deferred to that
> step (it will go **after** `protectRoute` on authenticated routers, so `req.user`
> exists). This keeps Step 1 behaviorally inert — the running app is unchanged.

---

## 4. API specification

All endpoints reuse existing conventions: JWT cookie auth via `protectRoute`, JSON
bodies, the `{ message }` error shape, and the "return the updated resource" pattern
(`updatePrivacy` is the template). New paths/schemas are added to `lib/swagger.js`.

### 4.1 Read flags + Dev Mode on auth check (extend existing)

`GET /api/auth/check` — **changed response** (additive fields only):

```jsonc
// 200
{
  "_id": "…", "fullName": "…", "email": "…", "username": "…",
  "profilePic": "…", "bio": "…", "status": "…", "isAdmin": false,
  "privacy": { "lastSeen": "everyone", "readReceipts": true, "profilePhoto": "everyone" },
  "devMode": { "enabled": false, "defaultForNewWorkspaces": false }, // ← NEW
  "flags": { "dev_mode": true }                                       // ← NEW
}
```

> **Important serializer detail:** `checkAuth` returns `req.user` (full doc minus
> password), so `devMode` flows automatically once it's on the schema — but the
> `publicUser()` serializer used by **login/signup/verify** is a curated subset and
> must be extended to include `devMode` (and the request must attach `flags`), or the
> client won't see Dev Mode until the next `checkAuth`. **Add `devMode` to
> `publicUser()` and attach `flags` on those responses.** (Captured as a task in §11.)

### 4.2 Set personal Dev Mode preference

`POST /api/auth/devmode` (auth) — mirrors `POST /api/auth/privacy`.

```jsonc
// request (all fields optional; at least one required)
{ "enabled": true, "defaultForNewWorkspaces": false }

// 200 → updated user (minus password), same shape as /auth/check
// 400 → { "message": "Nothing to update" }
// 403 → { "message": "Dev Mode is not available for your account" }  // flag off
```

Behavior: if `flags.dev_mode` is false for the caller, reject with 403 (can't enable
a flagged-off feature). Otherwise `$set` `devMode.enabled` / `devMode.defaultForNewWorkspaces`
and return the user.

### 4.3 Set workspace (group) Dev Mode

`PATCH /api/messages/conversations/:id/devmode` (auth, **group admin only**).

```jsonc
// request
{ "enabled": true }

// 200
{ "_id": "<convId>", "devMode": { "enabled": true, "enabledBy": "<userId>", "enabledAt": "…" } }
// 403 → flag off for caller, OR caller not an admin of the group
// 404 → conversation not found / not a member
// 400 → conversation is a DM (DMs are not workspaces)
```

Side effect: emits `workspace:devmode` to the conversation room (see §5).

### 4.4 Set workspace (community) Dev Mode

`PATCH /api/communities/:id/devmode` (auth, **community admin only**). Same body/return
shape as 4.3, scoped to the community; emits to all member sockets of the community’s
conversations.

### 4.5 Validation & authorization matrix

| Endpoint | Flag required | Authz | Notable validation |
|---|---|---|---|
| `POST /auth/devmode` | `dev_mode` for caller | self | ≥1 boolean field present |
| `PATCH …/conversations/:id/devmode` | `dev_mode` for caller | `conv.admins` includes caller | `conv.isGroup === true` |
| `PATCH /communities/:id/devmode` | `dev_mode` for caller | `community.admins` includes caller | exists & caller is member |

---

## 5. Realtime (Socket.IO)

One new event keeps every member's UI consistent the instant an admin flips a
workspace. Reuses the existing room model (sockets already join conversation rooms).

```ts
// emitted server-side after a successful workspace toggle
io.to(roomOf(conversationId)).emit("workspace:devmode", {
  conversationId,            // or communityId + affected conversationIds
  devMode: { enabled, enabledBy, enabledAt },
});
```

Client (`useChatStore.subscribeSocket`) handles it by patching the conversation in
place; `useDevModeStore` recomputes the resolved mode for the open chat. No refetch.

> **Multi-node note:** this rides the existing Socket.IO Redis adapter path when
> `REDIS_URL` is set — no new shared state. The flag evaluator is stateless, so a
> user’s flag result is identical on every node without coordination.

---

## 6. Frontend implementation plan

### 6.1 State

**`useDevModeStore.js` (new)** — the single source of "what mode is the UI in":

```js
// holds the flag snapshot + exposes the resolver; mirrors the server rule (§1.1)
export const useDevModeStore = create((set, get) => ({
  flags: {},                                  // from authUser.flags
  setFlags: (flags) => set({ flags }),

  // pure resolver — identical logic to backend resolveMode()
  resolve: (authUser, conversation) => {
    if (!get().flags.dev_mode) return "chat";                  // 1. flag gate
    const ws = conversation?.devMode;                          // 2. workspace override
    if (ws && typeof ws.enabled === "boolean") return ws.enabled ? "dev" : "chat";
    return authUser?.devMode?.enabled ? "dev" : "chat";        // 3. user default
  },
}));
```

A small `useEffect` in `App.jsx` sets `document.body.dataset.mode = resolvedMode` for
the **active** conversation so CSS/layout can react (`body[data-mode="dev"] …`) without
prop-drilling. Chat Mode is the default ⇒ zero visual change when flag/pref are off.

**`useAuthStore.js` (extend)** — add `setDevMode(changes)` mirroring `updatePrivacy`:

```js
setDevMode: async (changes) => {
  try {
    const res = await axiosInstance.post("/auth/devmode", changes);
    set({ authUser: res.data });
    toast.success("Dev Mode preference saved");
  } catch (e) {
    toast.error(e.response?.data?.message || "Couldn't update Dev Mode");
  }
},
```

On `checkAuth`/login success, also push `res.data.flags` into `useDevModeStore.setFlags`.

### 6.2 Components

- **`DevModeToggle.jsx` (new)** — a presentational DaisyUI `toggle` with two modes:
  - `variant="global"` → reads/writes `authUser.devMode.enabled` via `setDevMode`.
  - `variant="workspace"` → reads `conversation.devMode`, writes via a new
    `useChatStore.setWorkspaceDevMode(convId, enabled)` (PATCH from §4.3). Rendered
    **disabled with a tooltip** for non-admins (they see state, can't change it).
  - Hidden entirely when `flags.dev_mode` is false (feature is invisible pre-rollout).
- **`LeftRail.jsx`** — add a Dev Mode entry near the theme toggle: an icon
  (`Code`/`Terminal` from lucide) that toggles the global preference and shows an
  **active state** (lime accent, matching the new navy/lime palette) when in Dev Mode.
  Only rendered when `flags.dev_mode`.
- **`ChatHeader.jsx`** — for groups/communities, show the per-workspace toggle (admins)
  or a small "Dev workspace" badge (members) when the workspace is in Dev Mode.
- **`SettingsPage.jsx`** — new "**Developer**" section: the personal Dev Mode switch,
  "Enable Dev Mode by default in groups/communities I create" switch, and a read-only
  line showing rollout status (e.g., "Dev Mode is available on your account"). Section
  is hidden when the flag is off.

### 6.3 What Chat Mode users see

**Nothing changes.** With `flags.dev_mode` false (default), no toggles render, body
`data-mode` stays `chat`, and every component takes its existing path. This is the
hard guarantee behind Success Criteria.

### 6.4 What Dev Mode looks like in Phase 1 (deliberately minimal)

Toggling Dev Mode in Phase 1 changes **only**: (a) a visible mode indicator
(rail accent + header badge), and (b) `body[data-mode="dev"]` so Phase 2 can attach
the workspace layout. **No sidebar sections, code blocks, or tools yet** — those are
Phase 2+. This keeps Phase 1 shippable and low-risk while proving the switch works
end-to-end ("switch between Chat Mode and Dev Mode seamlessly").

---

## 7. Security considerations

| Risk | Mitigation |
|---|---|
| Enabling a flagged-off feature via direct API call | Every write endpoint re-checks `req.flags.dev_mode` server-side (client gating is cosmetic only). |
| Non-admin flips a workspace into/out of Dev Mode | Authz check against `conv.admins` / `community.admins` before write; 403 otherwise. |
| Toggling DMs as "workspaces" | `PATCH …/devmode` rejects `isGroup === false`. |
| Allowlist/rollout config leakage | Only the **resolved boolean** (`flags.dev_mode`) is sent to clients — never the allowlist, percentage, or other users' buckets. |
| Audit / abuse | `devMode.enabledBy` + `enabledAt` recorded on workspace toggles for traceability; the existing rate limiter (`/api` limiter) covers these routes. |
| CSRF | Unchanged — same SameSite cookie + CORS allowlist as all existing mutating routes. |
| Privilege via stale `flags` | Flags are recomputed per request server-side; a client holding a stale `true` still fails the server re-check once the master switch is off. |

No new secrets, no new third-party calls, no new PII. Threat surface is a few additive,
authz-gated boolean writes.

---

## 8. Scalability considerations

- **Flag evaluation is O(1), stateless, no I/O** (hash of `flag:userId` against env
  config) ⇒ adds negligible CPU per request and needs no shared store across nodes.
- **No new indexes / no hot-path queries.** Dev Mode fields are read off documents
  already loaded for the conversation/user; writes are rare (admin toggles).
- **Realtime** reuses existing conversation rooms and the optional Redis adapter; the
  new event is low-frequency (manual toggles), not per-message.
- **Payload impact:** `/auth/check` grows by ~2 small objects; negligible.
- **Forward-compatible:** when rollout config needs to be dynamic (no redeploy),
  `lib/flags.ts` can back `RULES` with a Redis/remote-config cache behind the same
  `isEnabled()` signature — callers don't change.

---

## 9. Testing strategy

Reuse the existing **Vitest + Supertest + mongodb-memory-server** harness.

**Unit**
- `flags.isEnabled`: master off ⇒ false; allowlist hit ⇒ true; rollout boundaries
  (pct 0 ⇒ all false, 100 ⇒ all true, stable bucket for a fixed id); unauth ⇒ false.
- `resolveMode` (shared logic): all 3 steps incl. workspace `false` override beating a
  user `true` default; unset workspace ⇒ inherits user.

**Integration (API)**
- `POST /auth/devmode`: 200 persists + echoes; 403 when flag off; 400 empty body.
- `PATCH …/conversations/:id/devmode`: admin 200; non-admin 403; DM 400; flag-off 403;
  emits `workspace:devmode` (assert via a connected test socket).
- `GET /auth/check` includes `devMode` + `flags`; `login`/`verify` (via `publicUser`)
  also include `devMode`.

**Frontend**
- `useDevModeStore.resolve` parity tests mirroring the backend `resolveMode` cases.
- Render: toggles absent when `flags.dev_mode` false; present + functional when true;
  workspace toggle disabled for non-admins.

**Regression (the critical one)**
- With the flag **off**, a full smoke of existing message/group/community flows shows
  **byte-identical** behavior (snapshot the `/auth/check` shape minus the new fields).

**Coverage gate:** new modules (`flags.ts`, `preferences.controller.ts`, resolver) at
the repo's existing threshold.

---

## 10. Migration strategy

- **No data migration.** All new fields are optional with safe defaults; Mongoose
  returns `devMode.enabled=false` semantics for legacy users on read (and `$set` on
  first write). Workspace `devMode` stays `unset` ⇒ "inherit", which is the safe default.
- **Schema rollout:** deploy backend (new optional fields + endpoints) **with the flag
  off** (`FEATURE_DEV_MODE=false`). Dormant code, zero user-visible change.
- **Backfill:** none required. (If product later wants every existing user to have an
  explicit `devMode` object, a one-shot idempotent script can `$set` defaults — but it
  is **not** needed for correctness, matching the repo's sparse-index philosophy.)
- **Order:** schema+API (flag off) → verify in prod → enable allowlist (internal) →
  ramp `DEV_MODE_ROLLOUT_PCT` → GA.

## 11. Rollback strategy

Three independent levels, fastest first:

1. **Kill switch (seconds, no deploy):** set `FEATURE_DEV_MODE=false` (or
   `DEV_MODE_ROLLOUT_PCT=0` + clear allowlist) and restart/rolling-restart. All clients
   re-resolve to Chat Mode on next request; server re-checks reject writes. Data is
   retained and inert.
2. **Code rollback (one deploy):** revert the Phase 1 PR. New fields become orphaned but
   harmless (optional, ignored). No DB cleanup needed.
3. **Data cleanup (only if ever desired):** an idempotent `$unset` script removes
   `user.devMode` / `*.devMode`. Not required for rollback correctness.

Because the feature is purely additive and flag-gated, **rollback never touches the
existing messaging paths.**

## 12. Production deployment plan

1. **Pre-flight:** add the 3 env vars to the deploy target (defaults keep it off);
   confirm `swagger.js` updated; CI green incl. the flag-off regression suite.
2. **Deploy (flag off):** ship backend + frontend. Verify `/auth/check` shows
   `flags.dev_mode=false`, existing flows unchanged, `/metrics` & `/health` nominal.
3. **Internal dogfood:** set `DEV_MODE_ALLOWLIST` to team userIds. Toggle personal +
   workspace Dev Mode; verify realtime broadcast, authz (non-admin 403), and that
   Chat Mode users in the same group are unaffected.
4. **Gradual rollout:** `DEV_MODE_ROLLOUT_PCT` 5 → 25 → 50 → 100, watching error rate,
   `/metrics` latency on the new routes, and Pino logs (correlation-id tagged).
5. **GA:** pct 100 (or `FEATURE_DEV_MODE` documented as default-on for new deploys).
6. **Observability:** add counters (reuse `prom-client`) for `devmode_toggle_total`
   (labels: scope=user|workspace, value=on|off) to watch adoption; structured logs on
   each toggle with `enabledBy`.

---

## 13. Phase summary

### Complexity estimate

| Area | Complexity | Notes |
|---|---|---|
| DB schema | **Low** | 3 optional fields, no indexes, no migration |
| Feature flags | **Low–Med** | New but small/pure; one-time design cost reused by all phases |
| API | **Low** | 1 new + 2 patch endpoints, copy the `updatePrivacy` pattern |
| Realtime | **Low** | 1 event over existing rooms |
| Frontend | **Medium** | New store + shared toggle + 3 touched surfaces; care to keep Chat Mode pixel-identical |
| Testing | **Medium** | Parity tests + flag-off regression are the bulk of the effort |
| **Overall** | **Low–Medium** | Mostly plumbing; risk concentrated in "don't disturb Chat Mode" |

### Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Regression in existing Chat Mode UX | Low | High | Flag-off-by-default; flag-off regression suite; `data-mode` defaults to chat |
| Server/client mode-resolution drift | Low | Medium | Single shared rule (§1.1) + parity tests |
| `publicUser()` omits `devMode` (client blind after login) | Medium | Low | Explicit task to extend serializer (§4.1) |
| Admin authz bypass on workspace toggle | Low | Medium | Server-side `admins` check + tests |
| Rollout config mistakes | Low | Low | Defaults are off; kill switch is instant |

### Expected implementation timeline

~**1 engineer-week** (5–6 working days):

- Day 1 — `flags.ts` + middleware + env + unit tests; schema additions.
- Day 2 — API endpoints (user + workspace) + Swagger + integration tests.
- Day 3 — Socket event + `useDevModeStore`/`useAuthStore` wiring + parity tests.
- Day 4 — UI: `DevModeToggle`, LeftRail, ChatHeader, Settings; keep Chat Mode identical.
- Day 5 — Flag-off regression pass, observability counters, docs, polish.
- Day 6 (buffer) — internal dogfood + rollout runbook dry-run.

### Recommended order of execution

1. **Feature flags** (`env` → `flags.ts` → `flags.middleware`) — everything gates on this.
2. **Schema** additions (user, conversation, community) — pure, no behavior change.
3. **`resolveMode`** shared rule + unit tests — lock the contract before wiring UI.
4. **API**: `publicUser`/`checkAuth` flag+devMode echo → `POST /auth/devmode` →
   workspace PATCH endpoints + Swagger.
5. **Realtime** event + client patch handling.
6. **Frontend** store wiring, then the shared toggle, then the 3 surfaces.
7. **Tests**: parity + the flag-off regression suite (gate for merge).
8. **Rollout**: deploy flag-off → allowlist → ramp → GA.

---

## 14. Acceptance criteria (Definition of Done)

- [ ] `FEATURE_DEV_MODE=false` ⇒ app is byte-for-byte the current experience (regression suite green).
- [ ] A flagged-in user can toggle **personal** Dev Mode (persists across reload/devices).
- [ ] A group/community **admin** can toggle **workspace** Dev Mode; members see it update in realtime.
- [ ] Non-admins cannot change workspace Dev Mode (403) but see its state.
- [ ] `resolveMode` is identical on server and client (parity tests green).
- [ ] Kill switch (`FEATURE_DEV_MODE=false`) returns everyone to Chat Mode with no deploy.
- [ ] Swagger documents all new/changed endpoints; `/auth/check` shape updated.
- [ ] No new indexes, no migration, no change to existing messaging hot paths.
