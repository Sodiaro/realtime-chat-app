# Phase 3 — Advanced Code Messaging (DESIGN)

**Status:** Proposed (awaiting approval — no code yet)
**Depends on:** Phase 1 (Dev Mode flag) · Phase 2 (Dev Workspace / Discussions)
**Goal:** Make **code a first-class message type** — syntax-highlighted, copyable,
downloadable, with Explain/Refactor/Review entry points — reusing the existing message
pipeline, with **Chat Mode untouched** and the AI actions wired as **stubs** (the engine
arrives in Phase 7).

---

## 0. Key architectural decision (read first)

The plan lists *"messageType: text, image, file, voice, code, system."* **The codebase does
not have a `messageType` enum** — message kind is **duck-typed** by which field is present
(`message.image`, `message.poll`, `message.file`, `message.call`, `message.system`, …), and
`MessageBubble`, the controllers, push notifications and previews all branch on field
presence.

Introducing a formal `messageType` enum would mean **backfilling every existing message and
refactoring every duck-typed branch** — a large, risky change that violates "avoid large
refactors / don't touch Chat Mode."

**So Phase 3 adds a `code` field** (exactly like `poll`/`file`/`contact`), keeping the
established pattern. If a normalized type label is ever wanted, it can be **derived** (a
computed `messageType` getter on serialization) **without storing or migrating** anything.

> This is the same "adapt the design to the real architecture" approach used in Phases 1–2.

---

## 1. Architecture changes

```
Compose (Dev Mode only)            Transport (unchanged)             Render (universal)
┌───────────────────────┐          ┌───────────────────────┐        ┌────────────────────┐
│ MessageInput           │          │ POST /messages/send/:id│        │ MessageBubble       │
│  + "Code" attach item  │  code →  │ POST …/conversation/:id│  →     │  + message.code →   │
│  → CodeModal           │  {lang,  │  (add `code` to body   │ socket │   <CodeBlock/>       │
│    (lang, file, body)  │  content,│   validation + build)  │ newMsg │   (lazy highlight)  │
│  sendMessage({code})   │  file}   │  Message.code persisted │        │  + Copy / Download  │
└───────────────────────┘          └───────────────────────┘        │  + AI actions (stub)│
   flag-gated affordance              additive field, no migration   └────────────────────┘
                                                                       renders for ALL viewers
```

- **Compose** is a developer affordance → **gated behind the `dev_mode` flag** (the "Code"
  button only appears for flagged-in users, so Chat Mode gains no new affordance).
- **Rendering is universal** — a received `code` message must always display correctly
  (regardless of the viewer's mode), the same way a poll always renders. This is additive:
  it only affects messages that *have* a `code` field (none exist today), so existing
  content is pixel-identical.
- **Transport is unchanged** — code rides the existing send endpoints + `newMessage` socket
  event. No new realtime plumbing.

---

## 2. Database schema changes

Additive, optional, no migration (consistent with every prior phase).

### `message.model.ts`
```ts
export interface ICode {
  language: string; // from an allowlist (see §6); "plaintext" fallback
  content: string;  // the snippet (size-capped server-side)
  filename?: string; // optional, for download + language inference
}

export interface IMessage {
  // …existing…
  code?: ICode;
}

// schema (single embedded subdoc, _id:false — like fileSchema/pollSchema)
const codeSchema = new Schema<ICode>(
  { language: String, content: String, filename: String },
  { _id: false }
);
// …in messageSchema:
code: codeSchema,
```

No new index (code is read off messages already loaded). No TTL/uniqueness concerns.

---

## 3. API specification

**No new endpoints for code itself** — it extends the existing send handlers.

### Extend `sendMessage` (`POST /api/messages/send/:id`) and `sendToConversation` (`POST /api/messages/conversation/:conversationId`)
Accept an optional `code` in the body and validate it:
```jsonc
// request (one of text/image/file/audio/poll/…/code)
{ "code": { "language": "ts", "content": "export const x = 1\n", "filename": "x.ts" },
  "replyTo": "…" }
```
Server validation (a small `buildCode()` helper, mirroring `buildPoll()`):
- `content` required, non-empty, **≤ 20 KB** (≈ 500 lines) → else `400`.
- `language` coerced to the **allowlist** (else `"plaintext"`).
- `filename` optional, **sanitized** (basename only, ≤ 100 chars).
Returns the created message (with `code`) as today (`201`), broadcast via `newMessage`.

### AI actions — **designed now, deferred to Phase 7**
The Explain/Refactor/Review buttons are **UI stubs** in Phase 3 (no backend). The future
contract (built in Phase 7) is documented so the buttons slot in:
```
POST /api/messages/:messageId/ai   { action: "explain" | "refactor" | "review" }
  → Phase 7: streams/returns an AI result (flag-gated, rate-limited, cost-controlled)
  → Phase 3: not implemented; the client shows a "coming in Phase 7" panel
```

### Swagger
Add `code` to the `Message` schema and to the two send request bodies (per the repo's
keep-Swagger-in-sync rule).

---

## 4. Frontend implementation plan

### New components
```
components/code/
  CodeBlock.jsx     ★ renders a code message: header (lang badge · filename · Copy ·
                       Download · ⋯AI) + highlighted, scrollable body; collapses long code
  CodeModal.jsx     ★ composer (language <select> + filename + monospace textarea), like PollModal
  highlight.js      ★ thin lazy wrapper around the highlighter (dynamic import + curated langs)
```

### Touch points (additive)
- **`MessageBubble.jsx`** — add a `message.code` branch rendering `<CodeBlock/>` (alongside
  the existing image/file/poll branches). Add **Copy code** / **Download snippet** to the
  action sheet for code messages, plus an **AI** submenu (Explain/Refactor/Review → stub).
- **`MessageInput.jsx`** — add a **"Code"** item to the existing attach (`+`) dropdown,
  **shown only when `flags.dev_mode`** (via `useDevModeStore`); it opens `CodeModal`, which
  calls `sendMessage({ code })`.
- **`useChatStore.sendMessage`** — already forwards arbitrary message bodies; pass `code`
  through (the optimistic-send path stays text/image-only, so code just posts normally).

### Syntax highlighting (lazy, lean)
- Use **`highlight.js` core + a curated language set** (`hljs/lib/core` with ~12 registered
  languages), **dynamically imported** the first time a code block renders. This keeps the
  main bundle lean (the build already warns at >500 KB) and costs Chat-Mode users nothing.
- `<CodeBlock>` shows the raw monospace text immediately, then upgrades to highlighted output
  once the highlighter chunk loads (progressive, no layout shift).

### UX of a code message (wireframe)
```
┌─────────────────────────────────────────────┐
│ ‹/› ts · x.ts            ⧉ Copy  ⤓  ⋯       │  ← header: lang badge·filename·copy·download·AI
├─────────────────────────────────────────────┤
│ 1  export const x = 1                        │  ← highlighted, monospace, h-scroll,
│ 2  export function add(a, b) { return a+b }  │     max-height with "Show more" on long code
└─────────────────────────────────────────────┘
   ⋯ → Explain · Refactor · Review  ("coming in Phase 7")
```

---

## 5. Security considerations

Rendering **untrusted code** is the central risk.

| Risk | Mitigation |
|---|---|
| **XSS via code content** | Never inject raw code as HTML. `highlight.js` **escapes** the source before adding `<span>` markup, so its output is safe; alternatively render the plain string in `<code>` (React auto-escapes). No `dangerouslySetInnerHTML` of unescaped user input, ever. |
| Arbitrary language → highlighter abuse | `language` validated against an **allowlist**; unknown → `"plaintext"` (no auto-detect on untrusted input). |
| DoS via huge snippets | **≤ 20 KB** content cap (server-enforced + client-guarded); long code collapses with "Show more" (no mega-DOM). |
| Malicious filename on download | Filename **sanitized** to a basename (strip `/`, `\`, `..`), capped length; download via `Blob` + object URL (no navigation). |
| Code execution | **None** — code is only ever displayed/highlighted; never `eval`'d or run. |
| Clipboard/file abuse | `navigator.clipboard.writeText` (text only); download is a client Blob. |
| Rate / spam | Inherits the existing `/api` limiter and admins-only-group gating. |

No new secrets, no new third-party network calls (the highlighter is a static client dep).

---

## 6. Scalability considerations

- **Highlighter is lazy-loaded** (dynamic import) and **client-side** — zero server cost,
  zero bundle cost for Chat-Mode users.
- **Curated language allowlist** (~12: `ts, js, jsx, tsx, python, go, rust, java, json, bash,
  sql, html, css, yaml, markdown`, + `plaintext`) keeps the highlighter chunk small.
- **No new collections/indexes**; `code` is a small capped string on the message doc.
- Transport unchanged (rides `newMessage`); no extra realtime load.

---

## 7. Testing strategy

- **Backend (Vitest/Supertest):** `sendMessage`/`sendToConversation` with `code` →
  persists + returns; rejects oversized content (`400`); coerces unknown language to
  `plaintext`; sanitizes filename; a code message round-trips via `GET` and broadcasts.
- **Frontend (`node:test` for pure bits):** the language-allowlist/sanitize helpers; a
  pure `isCode(message)` predicate. Component behavior (CodeBlock escaping, Copy/Download,
  flag-gated composer button) verified by build + manual QA (no React test runner in repo).
- **Regression:** flag-off → no "Code" button (Chat Mode composer unchanged); a non-code
  message renders identically; the full existing suite stays green.

---

## 8. Migration & 9. Rollback

- **Migration:** none — `code` is optional/additive; existing messages are unaffected; the
  derived `messageType` (if added) is computed, not stored.
- **Rollback:** the **composer** is flag-gated → flipping `dev_mode` off removes the affordance
  instantly. Already-sent code messages keep rendering (universal, harmless). Code rollback =
  revert the PR; the orphaned optional field is ignored. No data cleanup needed.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| XSS from rendering code | **High if mishandled** | Escaped highlighting only; size cap; no raw HTML (see §5) — the primary review focus |
| Bundle bloat from the highlighter | Medium | Lazy dynamic import + curated languages; nothing ships to Chat Mode |
| Touching `MessageBubble` (a Chat-Mode component) | Medium | Add a new `message.code` branch only; all existing branches untouched; flag-off regression check |
| Scope creep into real AI | Medium | AI actions are **UI stubs** this phase; engine is Phase 7 (contract documented, not built) |
| Inconsistent rendering across viewers | Low | Rendering is universal + duck-typed, like every existing type |

---

## 11. Recommended implementation order (incremental, each shippable)

1. **Backend** — `code` on the message model + `buildCode()` validation in both send handlers + Swagger + tests. *(invisible until the UI ships)*
2. **Render** — `highlight.js` lazy wrapper + `CodeBlock` + the `message.code` branch in `MessageBubble` (Copy/Download). *(code messages now display)*
3. **Compose** — `CodeModal` + the flag-gated "Code" attach item + `sendMessage({code})` wiring. *(developers can send code)*
4. **AI stubs** — Explain/Refactor/Review entry points on a code message → a "coming in Phase 7" panel; document the `POST /messages/:id/ai` contract.
5. **Polish & a11y** — long-code "Show more", language badge styling, keyboard/focus, copy/download affordances, reduced-motion; flag-off regression pass.

### Estimate & assessment
- **Complexity:** Medium (the highlighter + XSS-safe rendering are the real work; transport/schema are trivially additive).
- **Risk:** concentrated in **XSS-safe code rendering** and **not disturbing `MessageBubble`/Chat Mode** — both mitigated by escaped highlighting + the flag-off gate.
- **Timeline:** ~4–6 days for steps 1–5.
- **Success criteria:** a flagged-in developer can compose a syntax-highlighted code message in a workspace's Discussions; anyone can view/copy/download it; Explain/Refactor/Review are present as Phase-7 stubs; Chat Mode (and all existing message types) remain pixel-identical with the flag off.
```
