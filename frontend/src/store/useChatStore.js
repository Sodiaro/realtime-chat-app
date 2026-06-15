import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      // Backend now returns { messages, nextCursor } (cursor pagination).
      set({ messages: res.data.messages ?? res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
        isTyping: false, // a message arrived, so they've stopped typing
      });
      get().markMessagesRead(); // we're viewing this chat, so it's read
    });

    socket.on("typing", ({ from, isTyping }) => {
      if (from !== get().selectedUser?._id) return;
      set({ isTyping });
    });

    // the other person read our messages → flip our ticks to "seen"
    socket.on("messagesRead", ({ by }) => {
      if (by !== get().selectedUser?._id) return;
      const authUserId = useAuthStore.getState().authUser?._id;
      set({
        messages: get().messages.map((m) =>
          m.senderId === authUserId && !m.readAt
            ? { ...m, readAt: new Date().toISOString() }
            : m
        ),
      });
    });

    // edits, deletes and reactions arrive as a full replacement of the message
    socket.on("messageUpdated", (updated) => {
      set({
        messages: get().messages.map((m) => (m._id === updated._id ? updated : m)),
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("typing");
    socket.off("messagesRead");
    socket.off("messageUpdated");
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/${messageId}`, { text });
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to react");
    }
  },

  // tell the selected user whether we're currently typing
  emitTyping: (isTyping) => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket) return;
    socket.emit("typing", { to: selectedUser._id, isTyping });
  },

  // signal that we've seen the selected user's messages
  markMessagesRead: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket) return;
    socket.emit("markRead", { to: selectedUser._id });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser, isTyping: false }),
}));