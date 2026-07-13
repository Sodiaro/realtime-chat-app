// Pure mode-resolution rule. Mirrors the backend's Dev Mode contract EXACTLY so the
// server and client never disagree on "what mode is this":
//   1. feature-flag gate (hard kill-switch)      → "chat"
//   2. explicit per-workspace override (3-state)  → enabled ? "dev" : "chat"
//   3. the viewer's personal default              → enabled ? "dev" : "chat"
//
// `flags`   — the user's feature-flag snapshot, e.g. { dev_mode: true }
// `authUser`— the logged-in user (reads authUser.devMode.enabled)
// `context` — a conversation or community (reads context.devMode.enabled); null/absent
//             for DMs/global. A workspace whose devMode is absent ⇒ "inherit" (step 3);
//             { enabled:false } is an EXPLICIT chat override, distinct from absent.
//
// Kept dependency-free (no zustand/React) so it's trivially unit-testable in isolation.
export function resolveMode(flags, authUser, context) {
  if (!flags?.dev_mode) return "chat"; // 1. flag off ⇒ Chat Mode for everyone
  const ws = context?.devMode; // 2. explicit workspace override wins
  if (ws && typeof ws.enabled === "boolean") return ws.enabled ? "dev" : "chat";
  return authUser?.devMode?.enabled ? "dev" : "chat"; // 3. personal default / fallback
}

// A conversation becomes a Phase 2 "dev workspace" (secondary nav + sections) only when it
// is a GROUP and its resolved mode is "dev". DMs never become workspaces — even in personal
// Dev Mode they stay normal chats. This is the single gate HomePage uses; with the flag off
// it is always false, so Chat Mode is untouched.
export function isDevWorkspace(flags, authUser, conversation) {
  return Boolean(conversation?.isGroup) && resolveMode(flags, authUser, conversation) === "dev";
}
