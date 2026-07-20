# Phase 2 — Dev Workspace Experience (DESIGN)

**Status:** Implemented
**Depends on:** Phase 1 (Dev Mode flag + `resolveMode` + per-workspace `devMode`)
**Goal:** When a **group/community workspace** is in Dev Mode, present a developer
workspace (secondary nav + sections: Discussions, Repositories, Documentation, Issues,
Activity Feed) — **without touching Chat Mode**, which stays pixel-identical.

---

## 0. The safest approach (summary)

The existing chat surface ([HomePage.jsx](../../frontend/src/pages/HomePage.jsx)) renders
the conversation in one place:

```jsx
<div className={`${selectedUser ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
  {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
</div>
```

**Phase 2 changes exactly this one expression** to a three-way switch:

```jsx
{!selectedUser ? <NoChatSelected />
  : isDevWorkspace(selectedUser) ? <DevWorkspace conversation={selectedUser} />
  : <ChatContainer />}
```

- `isDevWorkspace = selectedUser.isGroup && resolveMode(flags, authUser, selectedUser) === "dev"`.
- **DMs and non-dev groups take the existing `<ChatContainer />` path verbatim** ⇒ Chat Mode is byte-for-byte unchanged.
- `DevWorkspace` renders the secondary nav and, for the **Discussions** section, **the same unchanged `<ChatContainer />`**. So chat infrastructure is *reused, not reimplemented*.

This is the whole risk surface: one conditional + new additive components. No refactor of
`ChatContainer`, `ChatHeader`, `Sidebar`, `MessageInput`, or any store.

---

## 1. Architecture changes

### 1.1 Gating (where Dev Mode turns a chat into a workspace)

```
HomePage (unchanged panes: LeftRail · chat-list Sidebar · [conversation] · InfoPanel)
                                                   │
                       selectedUser? ──────────────┤
                                                   ▼
                 ┌─────────────────────────────────────────────────────┐
                 │ group + resolveMode === "dev"   →  <DevWorkspace>     │
                 │ everything else (DMs, non-dev)  →  <ChatContainer>  ◄─┼─ UNCHANGED
                 └─────────────────────────────────────────────────────┘
```

Only **groups** get the workspace. A DM that resolves to "dev" via the *personal* default
stays a normal chat (DMs have no repos/issues). Communities reuse the same `DevWorkspace`
later (see §1.4) — Phase 2 ships it for group conversations first.

### 1.2 New components (all additive, none modify Chat Mode)

```
frontend/src/components/workspace/
  DevWorkspace.jsx        ★ wrapper: header + secondary nav + active section
  WorkspaceNav.jsx        ★ the secondary navigation (tabs; responsive)
  sections/
    DiscussionsSection.jsx★ thin wrapper → renders the existing <ChatContainer/>
    RepositoriesSection.jsx★ placeholder module (empty state)
    DocumentationSection.jsx★ placeholder module
    IssuesSection.jsx      ★ placeholder module
    ActivitySection.jsx    ★ placeholder module
    SectionEmptyState.jsx  ★ shared "coming soon" scaffold for modules
  sectionRegistry.js      ★ the expandable module registry (see §1.3)
```

### 1.3 The section registry (expandable modules — the core extensibility point)

A single source of truth that future phases extend by adding an entry. Each module is a
self-contained component that receives the workspace; it owns its own data fetching later.

```js
// sectionRegistry.js  (shape only — illustrative)
export const SECTIONS = [
  { id: "discussions",   label: "Discussions",   icon: MessageSquare, Component: DiscussionsSection, kind: "chat"   },
  { id: "repositories",  label: "Repositories",  icon: GitBranch,     Component: RepositoriesSection, kind: "module", phase: 6 },
  { id: "documentation", label: "Documentation", icon: BookOpen,      Component: DocumentationSection,kind: "module", phase: 5 },
  { id: "issues",        label: "Issues",        icon: CircleDot,     Component: IssuesSection,       kind: "module", phase: 6 },
  { id: "activity",      label: "Activity",      icon: Activity,      Component: ActivitySection,     kind: "module", phase: 8 },
];
```

- **Discussions (`kind:"chat"`)** is special-cased to render `<ChatContainer/>` — the WhatsApp/Slack core.
- **Modules (`kind:"module"`)** receive `{ conversation }` and render a placeholder now; a future phase swaps the body for real content **without touching the registry, nav, or layout**. Each can later declare `enabled(workspace)` for per-workspace module toggles and an optional `badge(workspace)` (e.g. open-issue count).
- Only the active section is mounted (lazy) — no upfront cost for unused modules.

### 1.4 Communities (designed-in, shipped later)

Communities already carry `devMode` (Phase 1). The same `DevWorkspace` + registry applies
to the community surface ([CommunitiesPage.jsx](../../frontend/src/pages/CommunitiesPage.jsx))
in a follow-on increment; Phase 2's deliverable is the **group conversation** workspace, with
the architecture intentionally workspace-type-agnostic (`DevWorkspace` takes a generic
`workspace` prop).

---

## 2. UI wireframes

### 2.1 Desktop (md+) — a dev-mode group is selected

The existing panes are untouched; only the conversation pane becomes the workspace.

```
┌────┬───────────────┬──────────────────────────────────────────────┬──────────┐
│ L  │ Chat list      │  DevWorkspace (replaces ChatContainer)        │  Info    │
│ e  │ (Sidebar —     │ ┌──────────────────────────────────────────┐ │  panel   │
│ f  │  UNCHANGED)    │ │ ⬤ Team Alpha  〈dev〉                       │ │ (xl,     │
│ t  │                │ │  # Discussions │ Repos │ Docs │ Issues │ ⚡ │ │  when    │
│ R  │ ⬤ Team Alpha ◀ │ ├──────────────────────────────────────────┤ │  chat    │
│ a  │ ⬤ Backend      │ │                                          │ │  open)   │
│ i  │ ⬤ Alice (DM)   │ │   ‹active section›                        │ │          │
│ l  │ …              │ │   Discussions → <ChatContainer/> (chat,   │ │          │
│ ⬤  │                │ │     header + messages + composer)         │ │          │
│ </>│                │ │   Repos/Docs/Issues/Activity → module     │ │          │
│68px│   ~260–480px   │ │                                          │ │ 260–460px│
└────┴───────────────┴──────────────────────────────────────────────┴──────────┘
        ▲ resizable                ▲ secondary nav = thin tab strip (~44px)
```

- **Secondary nav** = a horizontal tab strip at the top of the workspace pane (GitHub/Dev.to
  feel). A compact workspace label + `dev` chip sits on the left for context.
- **Discussions** shows the full, unchanged `<ChatContainer/>` below the strip (WhatsApp/Slack feel).
- **Modules** render their own section content (with a section sub-header) in the same area.
- The Phase-1 ChatHeader (with the workspace Dev-Mode toggle) remains inside ChatContainer on
  the Discussions tab, so admins can flip the workspace back to Chat Mode from there.

**Module placeholder (e.g. Repositories) — empty state:**
```
┌──────────────────────────────────────────────┐
│ ⬤ Team Alpha 〈dev〉  Discussions │[Repos]│ …   │
├──────────────────────────────────────────────┤
│                                              │
│            ⌥  Repositories                    │
│     Link GitHub repos to this workspace to    │
│     see commits, branches and PRs here.       │
│            [ Connect a repository ]  (disabled,│
│              “Coming in a later phase”)        │
│                                              │
└──────────────────────────────────────────────┘
```

### 2.2 Mobile (< md) — single pane, full-screen sections

Mobile stays single-pane (list → tap a chat → full-screen). For a dev-mode group, the
full-screen view is the workspace with a **scrollable** tab strip under a compact header.

```
┌───────────────────────────┐      ┌───────────────────────────┐
│ ‹ Back   Team Alpha 〈dev〉 │      │ ‹ Back   Team Alpha 〈dev〉 │
│ #Discussions Repos Docs ▸ │ swipe│  Discussions #Repos Docs ▸│
├───────────────────────────┤  →   ├───────────────────────────┤
│  (ChatContainer: messages │      │   ⌥ Repositories          │
│   + composer, full-screen)│      │   Link repos to see…      │
│                           │      │   [Connect] (coming soon) │
│  [ message input ]        │      │                           │
└───────────────────────────┘      └───────────────────────────┘
   Discussions tab (chat)             a module tab (placeholder)
```

- Tab strip is horizontally scrollable (overflow-x-auto), tabs are tap targets ≥44px.
- The existing mobile back button (in ChatHeader on Discussions) returns to the chat list;
  module tabs get their own compact header with the same Back affordance.
- No bottom-nav change — the secondary nav is the top tab strip, scoped to the open workspace.

### 2.3 Chat Mode (flag off, DMs, or non-dev group) — **unchanged**
Identical to today: `Sidebar` + `ChatContainer`, no tab strip, no workspace chrome.

---

## 3. State changes

Minimal and isolated — no changes to `useChatStore`/`useAuthStore` behavior.

- **`useWorkspaceStore` (new, localStorage-backed):**
  ```js
  {
    activeByWorkspace: {},                 // { [conversationId]: sectionId }
    setActiveSection(workspaceId, id),     // persists; defaults to "discussions"
    getActiveSection(workspaceId) -> id,   // "discussions" if unset
  }
  ```
  Per-workspace memory of the last-open section (mirrors the existing per-chat scroll/draft
  memory patterns). Resetting to `"discussions"` on mode-exit is handled in `DevWorkspace`.
- **Reuse, no new flags:** gating uses the Phase-1 `useDevModeStore.resolve(authUser, conversation)`
  and the `flags` subscription already wired into the client.
- **Section registry** is a static module (not store state).

No server state is required for Phase 2 (sections are placeholders; Discussions reuses the
existing message state).

---

## 4. Backend requirements

**Phase 2 requires no backend changes.**

- **Discussions** uses the existing message/conversation APIs and sockets unchanged.
- **Repositories / Documentation / Issues / Activity** ship as **frontend placeholders**; their
  data lands in later phases.

To keep modules *expandable*, the following backend shapes are **designed now, built later**
(one per future phase — listed so the module components are written against a stable contract):

| Module | Future endpoint (illustrative) | Phase |
|---|---|---|
| Repositories | `GET/POST /api/workspaces/:id/repos` | 6 (GitHub) |
| Documentation | `GET/POST /api/workspaces/:id/docs` | 5 (Docs Hub) |
| Issues | `GET /api/workspaces/:id/issues` | 6 |
| Activity | `GET /api/workspaces/:id/activity` (cursor) | 8 (Intelligence) |

Each maps to a workspace (`conversationId`/`communityId`) and is flag-gated + admin-aware,
reusing the Phase-1 patterns (`withFlags`, admin checks, audit fields).

> Optional, tiny, deferrable: a `lastSection` could be persisted server-side later; for Phase 2
> it lives in localStorage (no endpoint).

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Accidentally altering Chat Mode | **High if mishandled** | Single conditional swap; `ChatContainer`/`ChatHeader`/`Sidebar` untouched; DM + non-dev-group paths are the literal current code. A flag-OFF visual regression check is the merge gate. |
| Double chrome (workspace tab strip + ChatHeader on Discussions) | Low | Keep the strip thin (~44px, tabs + small label). Optional later refinement: an additive `hideHeader` prop on `ChatContainer` for a unified header — not required for Phase 2. |
| ChatContainer scroll/socket churn when switching sections | Low | ChatContainer already restores per-conversation scroll on mount and (un)subscribes cleanly; only the active section mounts. Switching away→back re-mounts and restores. |
| Mode toggled off while on a module tab | Low | `resolve` recomputes → workspace unmounts → falls back to `<ChatContainer/>`; reset active section to `discussions` on exit. |
| Responsive breakage (mobile/desktop/xl) | Medium | Workspace lives inside the existing `flex-1` pane and reuses its breakpoints; define mobile (scrollable top tabs, full-screen) and desktop (tab strip) separately; test all three widths. |
| Module placeholders feeling empty/broken | Low | Polished empty states with clear "coming in Phase N" copy; disabled CTAs, not dead buttons. |
| Communities not yet covered | Low (scope) | `DevWorkspace` is workspace-type-agnostic; communities are a follow-on increment. |
| A11y of the tab nav | Medium | Use a proper `role="tablist"`/`role="tab"`/`aria-selected` pattern with arrow-key navigation; each section is a labelled `role="tabpanel"`. |

---

## 6. Recommended implementation order (incremental, each shippable behind the flag)

1. **Scaffolding (no visible change):** `sectionRegistry.js` (Discussions + 4 module stubs) and
   `useWorkspaceStore` (active-section state). Unit-test the registry + store.
2. **Gating + shell:** `DevWorkspace` + `WorkspaceNav` + the one-line HomePage swap. Discussions
   renders the existing `<ChatContainer/>`; modules render a shared `SectionEmptyState`. ← *the
   visible "transformation," with placeholders.* Verify Chat Mode is untouched (flag-off regression).
3. **Responsive pass:** desktop tab strip + mobile scrollable tabs/full-screen; verify md / xl / mobile.
4. **Module empty states:** flesh out `RepositoriesSection` / `DocumentationSection` /
   `IssuesSection` / `ActivitySection` with their distinct, polished "coming soon" UIs.
5. **A11y + polish:** tablist semantics, keyboard nav, focus management, transitions.
6. **(Follow-on) Communities:** mount `DevWorkspace` on the community surface.
7. **(Future phases) Fill modules** with real backends per the §4 table.

### Estimate & assessment
- **Complexity:** Low–Medium. Almost entirely additive frontend; the gating is one conditional.
- **Risk:** concentrated in "don't disturb Chat Mode," mitigated by reuse + the flag-off gate.
- **Timeline:** ~3–5 days for steps 1–5 (shell + placeholders + responsive + a11y).
- **Success criteria:** a dev-mode group shows the workspace with working section nav;
  Discussions is the existing chat; Chat Mode (and DMs) remain pixel-identical with the flag off.
