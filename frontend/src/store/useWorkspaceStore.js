import { create } from "zustand";
import { resolveSectionId } from "../components/workspace/sectionRegistry.js";

// Per-workspace memory of the last-open Dev Workspace section (Phase 2). Persisted to
// localStorage, mirroring usePrefsStore. Unknown/invalid ids resolve to Discussions, so
// callers always get a valid section. No UI here — this is the state layer only.
const KEY = "devchat-workspace-sections";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const write = (map) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore (e.g. SSR / disabled storage) */
  }
};

export const useWorkspaceStore = create((set, get) => ({
  activeByWorkspace: read(), // { [workspaceId]: sectionId }

  getActiveSection: (workspaceId) => resolveSectionId(get().activeByWorkspace[workspaceId]),

  setActiveSection: (workspaceId, sectionId) => {
    const next = { ...get().activeByWorkspace, [workspaceId]: resolveSectionId(sectionId) };
    write(next);
    set({ activeByWorkspace: next });
  },
}));
