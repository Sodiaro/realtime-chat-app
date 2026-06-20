import { create } from "zustand";

// Conversation background (chat "wallpaper"). Lightweight, token-based, persisted.
const KEY = "devchat-chat-bg";

// full class names are spelled out as literals so Tailwind doesn't purge them
export const CHAT_BACKGROUNDS = [
  { key: "doodle", label: "Default", class: "chat-bg-doodle" },
  { key: "plain", label: "Plain", class: "chat-bg-plain" },
  { key: "aurora", label: "Aurora", class: "chat-bg-aurora" },
  { key: "dusk", label: "Dusk", class: "chat-bg-dusk" },
  { key: "mesh", label: "Mesh", class: "chat-bg-mesh" },
];
const VALID = CHAT_BACKGROUNDS.map((b) => b.key);

export const bgClass = (key) =>
  CHAT_BACKGROUNDS.find((b) => b.key === key)?.class || "chat-bg-doodle";

const saved = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "doodle";

export const useChatBgStore = create((set) => ({
  bg: VALID.includes(saved) ? saved : "doodle",
  setBg: (bg) => {
    if (!VALID.includes(bg)) return;
    try {
      localStorage.setItem(KEY, bg);
    } catch {
      /* ignore */
    }
    set({ bg });
  },
}));
