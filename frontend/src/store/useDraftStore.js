import { create } from "zustand";

// Unsent message text, kept per chat (keyed by the selected user's / group's id)
// and mirrored to localStorage so drafts survive reloads.
const KEY = "devchat-drafts";

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};

export const useDraftStore = create((set, get) => ({
  drafts: load(),

  getDraft: (id) => get().drafts[id] || "",

  setDraft: (id, text) => {
    if (!id) return;
    const drafts = { ...get().drafts };
    if (text && text.trim()) drafts[id] = text;
    else delete drafts[id];
    try {
      localStorage.setItem(KEY, JSON.stringify(drafts));
    } catch {
      /* storage full / disabled — keep in memory */
    }
    set({ drafts });
  },

  clearDraft: (id) => get().setDraft(id, ""),
}));
