import { create } from "zustand";

// which slide-over panel is open: "calls" | "scheduled" | "starred" | null
export const usePanelStore = create((set) => ({
  panel: null,
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
  togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
}));
