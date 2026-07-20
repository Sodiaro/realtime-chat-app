# DevChat → "WhatsApp for Developers" — Evolution Program

This folder holds the design specs for evolving **DevChat** from a WhatsApp-style
messenger into a developer collaboration platform, **without** redesigning the
existing product. Every phase is additive, feature-flagged, and must be
production-ready before the next begins.

## Guiding principles

1. **Chat Mode is untouched.** The WhatsApp-like experience is the default and the
   fallback. Dev Mode is purely additive and lives behind a feature flag.
2. **Incremental & reversible.** Each phase ships behind flags with a clean
   rollback. No destructive migrations — new fields are optional with safe defaults
   (the same philosophy as the existing sparse-index/no-migration approach).
3. **Reuse the existing architecture.** Mongoose models, the `auth` preferences
   pattern, Zustand stores, Socket.IO rooms, Swagger, Pino, prom-client — extend,
   don't replace.

## Phase status

| Phase | Title | Status | Spec |
|------:|-------|--------|------|
| 1 | Foundation & Mode System | ✅ Implemented | [design](./phase-1-foundation.md) · [rollout runbook](./phase-1-rollout.md) |
| 2 | Developer Workspace Layout | ✅ Implemented | [phase-2-workspace.md](./phase-2-workspace.md) |
| 3 | Advanced Code Messaging | ✅ Implemented | [phase-3-code-messaging.md](./phase-3-code-messaging.md) |
| 4 | Threaded Engineering Discussions | 📐 Designed | [phase-4-threaded-discussions.md](./phase-4-threaded-discussions.md) |
| 5 | Documentation Hub | ⏳ Not started | — |
| 6 | GitHub Integration | ⏳ Not started | — |
| 7 | AI Developer Assistant | ⏳ Not started | — |
| 8 | Project Intelligence | ⏳ Not started | — |
| 9 | Knowledge Extraction Engine | ⏳ Not started | — |

> Phases 1–3 are implemented behind the `dev_mode` flag; **Phase 4 (Threaded Engineering
> Discussions) is next**. Each phase is designed, reviewed and shipped before the next begins.

## How the two modes relate

```
                         ┌──────────────────────────────────────────┐
                         │                DevChat                    │
                         │                                           │
   ┌─────────────┐       │   ┌──────────────┐   ┌──────────────┐     │
   │  Chat Mode  │  ◄──► │   │  Mode System │   │ Feature Flags│     │
   │ (default,   │  toggle   │ (this phase) │   │ (this phase) │     │
   │  unchanged) │       │   └──────────────┘   └──────────────┘     │
   └─────────────┘       │          │                                │
                         │          ▼                                │
                         │   ┌──────────────┐                        │
                         │   │   Dev Mode   │  Phases 2–9 build here  │
                         │   │ (workspace,  │  (workspace layout,     │
                         │   │  code msgs,  │   code, threads, docs,  │
                         │   │  AI, …)      │   GitHub, AI, …)        │
                         │   └──────────────┘                        │
                         └──────────────────────────────────────────┘
```
