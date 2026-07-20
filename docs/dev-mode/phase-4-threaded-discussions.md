# Phase 4 — Threaded Engineering Discussions (DESIGN)

**Status:** Proposed (awaiting approval)
**Depends on:** Phase 1 (Dev Mode) · Phase 2 (Dev Workspace / Discussions)
**Goal:** Keep engineering discussion organized — reply *into* a message to open a thread,
with participants, reply counts, thread search, and a summary slot (AI summary is Phase 7).
Additive, gated on a workspace being in Dev Mode, Chat Mode untouched.

---

## 0. Key decisions

**Data model — extend `Message`, no new collection.** A thread is a set of replies rooted at
one top-level message. We add `threadRoot` to a reply and lightweight thread metadata to the
root, mirroring the existing duck-typed, additive schema style (`replyTo`, `code`, …). No
`Thread` collection, no migration.

**Flat threads (one level).** A reply's `threadRoot` must point to a *top-level* message
(never another reply) — like Slack/Discord. This keeps the model, queries and UI simple and
avoids unbounded nesting.

**Gated on the workspace's resolved mode.** Threading appears when the conversation resolves
to Dev Mode (`resolveMode(...) === "dev"`) — the same gate as the Phase 2 workspace. Chat-Mode
groups get no thread affordances and, since none can be created there, nothing is hidden.

**Threads are calm by default.** A thread reply updates thread metadata + notifies thread
participants; it does **not** bump the conversation's main `lastMessage`/unread or reorder the
chat list. (An optional "also send to channel" can come later.)

---

## 1. Architecture

```
 Main timeline (unchanged, minus thread replies)         Thread view (new, gated)
 ┌───────────────────────────────────────┐               ┌──────────────────────────┐
 │ … message …                           │  open thread  │ ‹root message›            │
 │ ‹root› Deploy is failing on prod  ▸───┼──────────────►│ ── 3 replies ──           │
 │        💬 3 replies · 2h ago          │               │ Alice: check the env      │
 │ … message …                           │               │ Bob:   rolled back        │
 └───────────────────────────────────────┘               │ [ reply in thread… ]      │
   query adds { threadRoot: {$exists:false} }             └──────────────────────────┘
                                                          GET /messages/thread/:rootId
   send reply with { threadRoot } ──► create reply (threadRoot set, out of timeline)
                                      ──► $inc root.threadCount, set threadLastReplyAt,
                                          $addToSet threadParticipants
                                      ──► emit message:threadReply to participants' rooms
```

- **Reuse everywhere:** the same `Message` model, the same send controllers (extended to accept
  `threadRoot`), the same per-user Socket.IO rooms, `MessageBubble` to render replies, and the
  existing slide-over/panel system for the thread view.
- **One new read path** (`GET /messages/thread/:rootId`) and **one new socket event**
  (`message:threadReply`). Everything else is additive fields + query predicates.

---

## 2. Data model changes (`message.model.ts`)

Additive, optional — no migration.

```ts
export interface IMessage {
  // …existing…
  threadRoot?: Types.ObjectId;      // set on a reply → the top-level message it threads under
  // thread metadata, maintained on the ROOT message:
  threadCount?: number;             // number of replies (incl. tombstoned)
  threadLastReplyAt?: Date;
  threadParticipants?: Types.ObjectId[]; // deduped repliers, for the participant facepile
}
```
```ts
// schema
threadRoot: { type: Schema.Types.ObjectId, ref: "Message", index: true },
threadCount: { type: Number },
threadLastReplyAt: { type: Date },
threadParticipants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: undefined },
```

- **New index:** `{ threadRoot: 1, createdAt: 1 }` for the thread fetch.
- **Timeline stays cheap:** the existing `{ conversationId, createdAt }` index serves the main
  query with the added `threadRoot: { $exists: false }` predicate.
- Duck-typed as usual: `threadRoot` present ⇒ it's a reply (hidden from timeline);
  `threadCount > 0` ⇒ the message has a thread.

---

## 3. API specification

### Exclude thread replies from the timeline (both fetch handlers)
`getMessages` and `getConversationMessages` add `threadRoot: { $exists: false }` to the query.
Root messages remain, now carrying `threadCount`/`threadLastReplyAt`/`threadParticipants`.

### Send a thread reply (extend existing send endpoints)
`POST /api/messages/send/:id` and `POST /api/messages/conversation/:id` accept an optional
`threadRoot`. Validation (a `resolveThreadRoot()` helper):
- root must exist, be in the **same conversation**, and be **top-level** (`root.threadRoot` unset) → else `400`.
- on success, in one write path: create the reply (`threadRoot` set), then atomically
  `$inc threadCount`, `$set threadLastReplyAt`, `$addToSet threadParticipants` on the root.
- emit `message:threadReply` (see §4). Does **not** touch conversation `lastMessage`/unread.

### Read a thread
`GET /api/messages/thread/:rootId` (auth, participant-only) → `{ root, replies, nextCursor }`,
cursor-paginated by `createdAt`, populated like the timeline.

### Thread search
`GET /api/messages/search?threadRoot=<id>` scopes the existing search to one thread; global
search continues to include replies (they're the same `Message` docs).

### Summarize (stub → Phase 7)
`POST /api/messages/thread/:rootId/summary` documented now, **not built** — the UI shows a
"coming in Phase 7" panel, exactly like the Phase 3 code AI stubs.

Swagger updated for the `Message` thread fields + the new routes.

---

## 4. Realtime

One new typed event, emitted to the conversation's participants (per-user rooms → Redis-routed):
```ts
"message:threadReply": (p: {
  reply: IMessage;                        // the new reply
  root: { _id: string; threadCount: number; threadLastReplyAt: string };
}) => void;
```
Client (`useThreadStore` + `useChatStore`): patch the root message's `threadCount`/badge in the
main timeline; if that thread is open, append the reply. No refetch, no polling.

---

## 5. Frontend / UI

New, additive; gated on the conversation's resolved Dev Mode.

```
components/thread/
  ThreadPanel.jsx    ★ slide-over/right-panel: root + replies + composer (reuses MessageBubble)
  ThreadReplyBar.jsx ★ the "💬 N replies · facepile · last reply" affordance under a root message
store/
  useThreadStore.js  ★ open thread id, replies, cursor; send/patch on socket
```
Touch points (additive branches, gated):
- **`MessageBubble`** — when `message.threadCount > 0` and the chat is a dev workspace, render
  `<ThreadReplyBar>`; add **"Reply in thread"** to the action sheet.
- **`HomePage`/panel host** — mount `<ThreadPanel>` (desktop: right panel like `ChatInfoPanel`;
  mobile: full-screen slide-over) via the existing panel/slide-over system.
- **Composer** — the thread composer reuses the message-input behavior, sending with `threadRoot`.

**Success feel:** click "3 replies" → thread opens beside the chat; reply there; the main
timeline stays calm with just an updated count. WhatsApp bubbles · Slack/Discord threads.

---

## 6. Security
- **Authorization:** thread read/reply require conversation participation; admins-only groups
  still gate posting. Reuses existing checks.
- **Validation:** `threadRoot` must be same-conversation + top-level (no cross-chat or nested
  threads); IDs validated; reply body reuses existing content validation (incl. Phase 3 code caps).
- **No new surface for untrusted content** — replies are ordinary messages through the same pipeline.
- **Abuse:** inherits the `/api` rate limiter; `$addToSet` keeps participants bounded.

## 7. Scalability
- Root-stored `threadCount`/`threadLastReplyAt` ⇒ **no count/aggregate on timeline render**.
- Thread fetch served by the `{ threadRoot, createdAt }` index; cursor-paginated.
- Timeline adds a single `$exists:false` predicate on the existing index — negligible.
- Realtime is per-reply to participant rooms (low volume), Redis-adapter friendly.

## 8. Testing
- **Backend:** reply with `threadRoot` → created out of timeline + root metadata updated;
  rejects cross-conversation / nested / missing root (`400`); thread fetch pagination;
  timeline excludes replies; delete-root/reply edge cases; participant authz.
- **Frontend (node:test):** a pure `isThreadReply`/`hasThread` predicate + reply-count/label
  formatting; store reducer for the socket patch. Component behavior via build + manual QA.
- **Regression:** flag/mode off ⇒ no thread affordances; existing timeline byte-identical; full suite green.

## 9. Migration & rollback
- **Migration:** none — optional fields + one additive index (built on boot); existing messages
  read as top-level (no `threadRoot`) exactly as today.
- **Rollback:** gated on Dev Mode — off ⇒ affordances vanish, fields dormant. Revert the PR;
  orphaned optional fields are ignored. No data cleanup.

## 10. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Timeline query regression from the `$exists` predicate | Medium | Served by the existing index; benchmarked; behind the additive filter only |
| Root metadata drift (count vs. actual) | Low–Med | Single atomic update path on send; tombstones keep count stable; a recount script if ever needed |
| Touching `MessageBubble`/timeline (Chat-Mode risk) | Medium | New gated branches only; flag-off regression gate |
| Thread + disappearing/view-once interplay | Low | Thread replies inherit the conversation timer; view-once disallowed in threads (validated) |
| Scope creep into AI summaries | Low | Summary is a Phase-7 stub |

## 11. Recommended implementation order (each its own commit on this branch)
1. **Data model** — thread fields + index + timeline exclusion in both fetch handlers. *(invisible)*
2. **API** — `resolveThreadRoot()` + send-with-`threadRoot` + `GET /thread/:rootId` + Swagger + tests.
3. **Realtime** — `message:threadReply` emit + `useThreadStore` socket handling.
4. **UI** — `ThreadReplyBar` + `ThreadPanel` + "Reply in thread", gated on resolved Dev Mode.
5. **Search + summary stub + polish/a11y + flag-off regression.**

### Estimate & assessment
- **Complexity:** Medium–High (thread lifecycle + a new UI surface; data/transport are additive).
- **Risk:** concentrated in the timeline query change and not disturbing Chat Mode — mitigated by indexing + the flag-off gate.
- **Timeline:** ~5–7 days across steps 1–5.
- **Success criteria:** in a dev-workspace group, replying in thread opens an organized thread with live counts/participants and search; the main timeline stays calm; Chat Mode is untouched with the flag off.
```
