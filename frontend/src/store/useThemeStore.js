import { create } from "zustand";

// Focused two-theme system. `mode` is the user's choice (system | light | dark);
// it resolves to one of the daisyUI design-token themes (devlight | devdark).
const STORAGE_KEY = "devchat-theme";
const media =
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

const systemTheme = () => (media?.matches ? "devdark" : "devlight");
const resolveTheme = (mode) =>
  mode === "system" ? systemTheme() : mode === "dark" ? "devdark" : "devlight";

const apply = (theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "devdark" ? "#0e1015" : "#ffffff");
};

const savedMode = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "system";
apply(resolveTheme(savedMode));

export const useThemeStore = create((set, get) => ({
  mode: savedMode, // "system" | "light" | "dark"
  resolved: resolveTheme(savedMode), // "devlight" | "devdark"

  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    const resolved = resolveTheme(mode);
    apply(resolved);
    set({ mode, resolved });
  },

  // quick light/dark flip (used by the navbar toggle)
  toggle: () => {
    const next = get().resolved === "devdark" ? "light" : "dark";
    get().setMode(next);
  },
}));

// keep "system" mode in sync with OS changes
media?.addEventListener?.("change", () => {
  if (useThemeStore.getState().mode !== "system") return;
  const resolved = systemTheme();
  apply(resolved);
  useThemeStore.setState({ resolved });
});
