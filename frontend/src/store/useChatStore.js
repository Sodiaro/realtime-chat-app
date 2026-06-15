import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  conversations: [], // group conversations
  selectedUser: null, // a user (DM) or a group-shaped object { isGroup, _id, fullName }
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  replyingTo: null, // message being replied to
  forwarding: null, // message being forwarded (opens the picker)

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

  getConversations: async () => {
    try {
      const res = await axiosInstance.get("/messages/conversations");
      set({ conversations: res.data.filter((c) => c.isGroup) });
    } catch {
      /* non-fatal */
    }
  },

  createGroup: async (name, memberIds) => {
    try {
      const res = await axiosInstance.post("/messages/group", { name, members: memberIds });
      set({ conversations: [res.data, ...get().conversations] });
      toast.success("Group created");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
    }
  },

  getMessages: async (id) => {
    set({ isMessagesLoading: true });
    const { selectedUser } = get();
    try {
      const url = selectedUser?.isGroup
        ? `/messages/conversation/${selectedUser._id}`
        : `/messages/${id}`;
      const res = await axiosInstance.get(url);
      set({ messages: res.data.messages ?? res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const url = selectedUser.isGroup
        ? `/messages/conversation/${selectedUser._id}`
        : `/messages/send/${selectedUser._id}`;
      const res = await axiosInstance.post(url, messageData);
      set({ messages: [...messages, res.data], replyingTo: null });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const sel = get().selectedUser;
      const belongs = sel?.isGroup
        ? newMessage.conversationId === sel._id
        : newMessage.senderId === sel?._id;
      if (!belongs) return;

      set({
        messages: [...get().messages, newMessage],
        isTyping: false, // a message arrived, so they've stopped typing
      });
      if (!sel.isGroup) get().markMessagesRead(); // we're viewing this DM
    });

    // a new group we were added to
    socket.on("conversationCreated", (conversation) => {
      set({ conversations: [conversation, ...get().conversations] });
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
    socket.off("conversationCreated");
  },

  reportMessage: async (messageId, reason) => {
    try {
      await axiosInstance.post(`/messages/${messageId}/report`, { reason });
      toast.success("Reported. Thanks for flagging this.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to report");
    }
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

  pinMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/pin`);
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to pin");
    }
  },

  forwardMessage: async (messageId, toUserId) => {
    try {
      await axiosInstance.post(`/messages/${messageId}/forward`, { to: toUserId });
      toast.success("Message forwarded");
      set({ forwarding: null });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward");
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),
  setForwarding: (message) => set({ forwarding: message }),

  // tell the selected user whether we're currently typing
  emitTyping: (isTyping) => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || selectedUser.isGroup || !socket) return; // DMs only
    socket.emit("typing", { to: selectedUser._id, isTyping });
  },

  // signal that we've seen the selected user's messages
  markMessagesRead: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || selectedUser.isGroup || !socket) return; // DMs only
    socket.emit("markRead", { to: selectedUser._id });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser, isTyping: false }),
}));