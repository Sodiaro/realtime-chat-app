import { create } from "zustand";
import { resolveMode } from "./resolveMode.js";

// Single source of truth for "what mode is the UI in". Holds the per-user feature-flag
// snapshot (synced from authUser.flags by useAuthStore) and exposes the resolver.
//
// NO DOM/UI side effects here — this is the state layer only. Components subscribing to
// `flags`/`resolve`, the body[data-mode] wiring, and the toggles all come in a later UI step.
export const useDevModeStore = create((set, get) => ({
  flags: {}, // e.g. { dev_mode: true } — kept in sync with the authenticated user

  // keep the flag snapshot in step with the current user (called on every auth change)
  syncFlags: (flags) => set({ flags: flags || {} }),

  // is the Dev Mode feature available to this user at all? (used for UI gating later)
  isDevModeAvailable: () => Boolean(get().flags?.dev_mode),

  // resolve the active mode ("dev" | "chat") for a workspace context using the synced
  // flags. Delegates to the pure rule so the client stays in lockstep with the server.
  resolve: (authUser, context) => resolveMode(get().flags, authUser, context),
}));
