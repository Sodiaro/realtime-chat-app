import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

// short notification beep (best-effort; browsers may block without a gesture)
const playDing = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    /* ignore */
  }
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  conversations: [], // group conversations
  selectedUser: null, // a user (DM) or a group-shaped object { isGroup, _id, fullName }
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  isRecordingPeer: false, // the other user is recording a voice note
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
      set({ conversations: res.data }); // all: groups + DMs (for unread badges)
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

      // opening a chat clears its unread badge (server already zeroed it)
      const sel = get().selectedUser;
      set({
        conversations: get().conversations.map((c) => {
          const match = sel?.isGroup
            ? c._id === sel._id
            : !c.isGroup && c.participants?.some((p) => (p._id || p) === sel?._id);
          return match ? { ...c, unread: 0 } : c;
        }),
      });
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

    socket.on("recording", ({ from, isRecording }) => {
      if (from !== get().selectedUser?._id) return;
      set({ isRecordingPeer: isRecording });
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
    socket.off("typing");
    socket.off("recording");
    socket.off("messagesRead");
    socket.off("messageUpdated");
  },

  // global listeners — set up once per session (App), survive chat switches
  subscribeSocket: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (msg) => {
      const sel = get().selectedUser;
      const isDM = Boolean(msg.receiverId);
      const isOpen =
        !!sel && (sel.isGroup ? msg.conversationId === sel._id : isDM && msg.senderId === sel._id);

      if (isOpen) {
        set({
          messages: [...get().messages, msg],
          isTyping: false,
          isRecordingPeer: false,
        });
        if (!sel.isGroup) get().markMessagesRead(); // read implies delivered
      } else {
        get().bumpUnread(msg.conversationId);
        if (isDM) socket.emit("markDelivered", { to: msg.senderId }); // tell the sender
      }

      if (typeof document !== "undefined" && (document.hidden || !isOpen)) get().notify(msg);
    });

    socket.on("conversationCreated", (conversation) => {
      set({ conversations: [conversation, ...get().conversations] });
    });

    socket.on("conversationUpdated", (conv) => {
      const myId = useAuthStore.getState().authUser?._id;
      const amIn = conv.participants?.some((p) => (p._id || p) === myId);
      set((state) => {
        const conversations = amIn
          ? state.conversations.map((c) =>
              c._id === conv._id
                ? { ...c, name: conv.name, participants: conv.participants, admins: conv.admins }
                : c
            )
          : state.conversations.filter((c) => c._id !== conv._id);
        let selectedUser = state.selectedUser;
        if (selectedUser?._id === conv._id) {
          selectedUser = amIn
            ? { ...selectedUser, fullName: conv.name, name: conv.name, participants: conv.participants, admins: conv.admins }
            : null;
        }
        return { conversations, selectedUser };
      });
    });

    // the other person's device received our messages → grey double-tick
    socket.on("messagesDelivered", ({ by }) => {
      const authUserId = useAuthStore.getState().authUser?._id;
      if (by !== get().selectedUser?._id) return;
      set({
        messages: get().messages.map((m) =>
          m.senderId === authUserId && !m.deliveredAt
            ? { ...m, deliveredAt: new Date().toISOString() }
            : m
        ),
      });
    });
  },

  unsubscribeSocket: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("conversationCreated");
    socket.off("conversationUpdated");
    socket.off("messagesDelivered");
  },

  // increment a conversation's unread count locally (or refetch if unknown)
  bumpUnread: (conversationId) => {
    const convs = get().conversations;
    const idx = convs.findIndex((c) => c._id === conversationId);
    if (idx === -1) {
      get().getConversations(); // first message of a new conversation
      return;
    }
    const updated = [...convs];
    updated[idx] = { ...updated[idx], unread: (updated[idx].unread || 0) + 1 };
    set({ conversations: updated });
  },

  // browser notification for a message arriving outside the open/focused chat
  notify: (msg) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const conv = get().conversations.find((c) => c._id === msg.conversationId);
    if (conv?.isMuted) return; // muted conversation — stay silent
    const sender = get().users.find((u) => u._id === msg.senderId);
    const body =
      msg.text || (msg.image ? "📷 Photo" : msg.audio ? "🎤 Voice note" : "New message");
    try {
      const n = new Notification(sender?.fullName || "New message", {
        body,
        icon: sender?.profilePic || "/favicon.svg",
      });
      n.onclick = () => window.focus();
    } catch {
      /* ignore */
    }
    playDing();
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

  starMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/star`);
      const myId = useAuthStore.getState().authUser?._id;
      set({
        messages: get().messages.map((m) => {
          if (m._id !== messageId) return m;
          const starredBy = res.data.starred
            ? [...(m.starredBy || []), myId]
            : (m.starredBy || []).filter((id) => id !== myId);
          return { ...m, starredBy };
        }),
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to star");
    }
  },

  toggleMute: async (conversationId) => {
    try {
      const res = await axiosInstance.post(`/messages/conversation/${conversationId}/mute`);
      set({
        conversations: get().conversations.map((c) =>
          c._id === conversationId ? { ...c, isMuted: res.data.isMuted } : c
        ),
      });
      toast.success(res.data.isMuted ? "Muted" : "Unmuted");
    } catch {
      toast.error("Failed to mute");
    }
  },

  toggleArchive: async (conversationId) => {
    try {
      const res = await axiosInstance.post(`/messages/conversation/${conversationId}/archive`);
      set({
        conversations: get().conversations.map((c) =>
          c._id === conversationId ? { ...c, isArchived: res.data.isArchived } : c
        ),
      });
      toast.success(res.data.isArchived ? "Archived" : "Unarchived");
    } catch {
      toast.error("Failed to archive");
    }
  },

  renameGroup: async (conversationId, name) => {
    try {
      await axiosInstance.patch(`/messages/conversation/${conversationId}`, { name });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to rename");
    }
  },

  addGroupMembers: async (conversationId, members) => {
    try {
      await axiosInstance.post(`/messages/conversation/${conversationId}/members`, { members });
      toast.success("Members added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add members");
    }
  },

  removeGroupMember: async (conversationId, userId) => {
    try {
      await axiosInstance.delete(`/messages/conversation/${conversationId}/members/${userId}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  },

  leaveGroup: async (conversationId) => {
    try {
      await axiosInstance.post(`/messages/conversation/${conversationId}/leave`);
      set({
        conversations: get().conversations.filter((c) => c._id !== conversationId),
        selectedUser: null,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave");
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

  emitRecording: (isRecording) => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || selectedUser.isGroup || !socket) return; // DMs only
    socket.emit("recording", { to: selectedUser._id, isRecording });
  },

  // signal that we've seen the selected user's messages
  markMessagesRead: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || selectedUser.isGroup || !socket) return; // DMs only
    socket.emit("markRead", { to: selectedUser._id });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser, isTyping: false, isRecordingPeer: false }),
}));