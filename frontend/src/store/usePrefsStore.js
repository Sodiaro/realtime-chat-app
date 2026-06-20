import { create } from "zustand";

// lightweight client-side preferences, persisted to localStorage
const read = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export const usePrefsStore = create((set) => ({
  soundEnabled: read("devchat-sound", true), // play a ding on new messages
  enterToSend: read("devchat-enter-send", true), // Enter sends vs newline
  disappearingDefault: read("devchat-disappear-default", 0), // minutes for new chats (0 = off)

  setSound: (v) => {
    write("devchat-sound", v);
    set({ soundEnabled: v });
  },
  setEnterToSend: (v) => {
    write("devchat-enter-send", v);
    set({ enterToSend: v });
  },
  setDisappearingDefault: (v) => {
    write("devchat-disappear-default", v);
    set({ disappearingDefault: v });
  },
}));
