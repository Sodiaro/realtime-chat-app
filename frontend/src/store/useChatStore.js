import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

// append a message, or replace it if one with the same id already exists
// (guards against any double-delivery so a message can never duplicate)
const upsert = (list, msg) =>
  list.some((m) => m._id === msg._id)
    ? list.map((m) => (m._id === msg._id ? msg : m))
    : [...list, msg];

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
  nextCursor: null, // cursor for loading older messages (scroll-up)
  isLoadingOlder: false,
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

  searchUsers: async (q) => {
    try {
      const res = await axiosInstance.get("/messages/users/search", { params: { q } });
      return res.data;
    } catch {
      return [];
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
    set({ isMessagesLoading: true, nextCursor: null });
    const { selectedUser } = get();
    try {
      const url = selectedUser?.isGroup
        ? `/messages/conversation/${selectedUser._id}`
        : `/messages/${id}`;
      const res = await axiosInstance.get(url);
      set({
        messages: res.data.messages ?? res.data,
        nextCursor: res.data.nextCursor ?? null,
      });

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

  // load an older page (scroll-up). Returns true when it prepended messages,
  // so the caller can restore scroll position.
  loadOlderMessages: async () => {
    const { selectedUser, nextCursor, isLoadingOlder, messages } = get();
    if (!selectedUser || !nextCursor || isLoadingOlder) return false;
    set({ isLoadingOlder: true });
    try {
      const base = selectedUser.isGroup
        ? `/messages/conversation/${selectedUser._id}`
        : `/messages/${selectedUser._id}`;
      const res = await axiosInstance.get(base, { params: { cursor: nextCursor } });
      const older = res.data.messages ?? [];
      // drop any ids we already have, then prepend (older first)
      const have = new Set(messages.map((m) => m._id));
      const fresh = older.filter((m) => !have.has(m._id));
      set({ messages: [...fresh, ...messages], nextCursor: res.data.nextCursor ?? null });
      return fresh.length > 0;
    } catch {
      return false;
    } finally {
      set({ isLoadingOlder: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const myId = useAuthStore.getState().authUser?._id;
    const url = selectedUser.isGroup
      ? `/messages/conversation/${selectedUser._id}`
      : `/messages/send/${selectedUser._id}`;

    // show plain text/image instantly; richer types need server processing first
    const canOptimistic =
      (messageData.text || messageData.image) &&
      !messageData.poll &&
      !messageData.file &&
      !messageData.audio &&
      !messageData.location &&
      !messageData.contact;

    let tempId = null;
    if (canOptimistic) {
      tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic = {
        _id: tempId,
        conversationId: selectedUser.isGroup ? selectedUser._id : undefined,
        senderId: myId,
        receiverId: selectedUser.isGroup ? undefined : selectedUser._id,
        text: messageData.text,
        image: messageData.image,
        reactions: [],
        readBy: [],
        starredBy: [],
        createdAt: new Date().toISOString(),
        pending: true,
      };
      set({ messages: [...messages, optimistic], replyingTo: null });
    }

    try {
      const res = await axiosInstance.post(url, messageData);
      set({
        messages: tempId
          ? get().messages.map((m) => (m._id === tempId ? res.data : m)) // swap temp → real
          : upsert(get().messages, res.data),
        replyingTo: null,
      });
      get().touchConversation(res.data.conversationId); // move chat to top
    } catch (error) {
      if (tempId) {
        // leave the bubble visible, flagged as failed
        set({
          messages: get().messages.map((m) =>
            m._id === tempId ? { ...m, pending: false, failed: true } : m
          ),
        });
      }
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    // ensure single registration (StrictMode / re-open can double these)
    socket.off("recording");
    socket.off("typing");
    socket.off("messagesRead");
    socket.off("messageUpdated");

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
    // ensure single registration (effects can run twice in dev StrictMode)
    socket.off("newMessage");
    socket.off("conversationCreated");
    socket.off("conversationUpdated");
    socket.off("messagesDelivered");
    socket.off("groupMessagesRead");

    // a group member read messages → add them to readBy of the open group's messages
    socket.on("groupMessagesRead", ({ conversationId, userId }) => {
      const sel = get().selectedUser;
      if (!sel?.isGroup || sel._id !== conversationId) return;
      const myId = useAuthStore.getState().authUser?._id;
      set({
        messages: get().messages.map((m) =>
          m.senderId === myId && !(m.readBy || []).includes(userId)
            ? { ...m, readBy: [...(m.readBy || []), userId] }
            : m
        ),
      });
    });

    socket.on("newMessage", (msg) => {
      const sel = get().selectedUser;
      const myId = useAuthStore.getState().authUser?._id;
      const mine = msg.senderId === myId; // my own message echoed back (scheduled / other device)
      const isDM = Boolean(msg.receiverId);
      // the "other party" of a DM is the receiver when I sent it, else the sender
      const peerId = isDM ? (mine ? msg.receiverId : msg.senderId) : null;
      const isOpen =
        !!sel && (sel.isGroup ? msg.conversationId === sel._id : peerId === sel._id);

      if (isOpen) {
        set({
          messages: upsert(get().messages, msg),
          isTyping: false,
          isRecordingPeer: false,
        });
        get().touchConversation(msg.conversationId); // move chat to top
        if (!mine && !sel.isGroup) get().markMessagesRead(); // read implies delivered
      } else if (mine) {
        get().touchConversation(msg.conversationId); // my own send from elsewhere — no unread
      } else {
        get().bumpUnread(msg.conversationId);
        if (isDM) socket.emit("markDelivered", { to: msg.senderId }); // tell the sender
      }

      // never notify for my own messages
      if (!mine && typeof document !== "undefined" && (document.hidden || !isOpen)) get().notify(msg);
    });

    socket.on("conversationCreated", (conversation) => {
      set({ conversations: [conversation, ...get().conversations] });
    });

    socket.on("conversationUpdated", (conv) => {
      const myId = useAuthStore.getState().authUser?._id;
      const amIn = conv.participants?.some((p) => (p._id || p) === myId);
      set((state) => {
        const merge = {
          name: conv.name,
          avatar: conv.avatar,
          description: conv.description,
          onlyAdminsCanMessage: conv.onlyAdminsCanMessage ?? false,
          participants: conv.participants,
          admins: conv.admins,
          disappearMinutes: conv.disappearMinutes ?? 0,
        };
        const conversations = amIn
          ? state.conversations.map((c) => (c._id === conv._id ? { ...c, ...merge } : c))
          : state.conversations.filter((c) => c._id !== conv._id);
        let selectedUser = state.selectedUser;
        if (selectedUser?._id === conv._id) {
          selectedUser = amIn
            ? { ...selectedUser, ...merge, fullName: conv.name }
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
    socket.off("groupMessagesRead");
  },

  // increment a conversation's unread count + bump its activity time
  bumpUnread: (conversationId) => {
    const convs = get().conversations;
    const idx = convs.findIndex((c) => c._id === conversationId);
    if (idx === -1) {
      get().getConversations(); // first message of a new conversation
      return;
    }
    const updated = [...convs];
    updated[idx] = {
      ...updated[idx],
      unread: (updated[idx].unread || 0) + 1,
      lastMessageAt: new Date().toISOString(),
    };
    set({ conversations: updated });
  },

  // move a conversation to the top of the list (new activity, no unread change)
  touchConversation: (conversationId) => {
    const convs = get().conversations;
    const idx = convs.findIndex((c) => c._id === conversationId);
    if (idx === -1) {
      get().getConversations(); // not in the list yet (first message)
      return;
    }
    const updated = [...convs];
    updated[idx] = { ...updated[idx], lastMessageAt: new Date().toISOString() };
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

  votePoll: async (messageId, optionIndex) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/vote`, { optionIndex });
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to vote");
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

  togglePin: async (conversationId) => {
    try {
      const res = await axiosInstance.post(`/messages/conversation/${conversationId}/pin`);
      set({
        conversations: get().conversations.map((c) =>
          c._id === conversationId ? { ...c, isPinned: res.data.isPinned } : c
        ),
      });
      toast.success(res.data.isPinned ? "Pinned to top" : "Unpinned");
    } catch {
      toast.error("Failed to pin");
    }
  },

  // ---- scheduled messages ----
  getScheduled: async () => {
    try {
      const res = await axiosInstance.get("/messages/scheduled");
      return res.data;
    } catch {
      return [];
    }
  },

  scheduleMessage: async ({ text, image, file, scheduledAt }) => {
    const { selectedUser } = get();
    if (!selectedUser) return false;
    const target = selectedUser.isGroup
      ? { conversationId: selectedUser._id }
      : { to: selectedUser._id };
    try {
      await axiosInstance.post("/messages/scheduled", { ...target, text, image, file, scheduledAt });
      toast.success("Message scheduled");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to schedule");
      return false;
    }
  },

  cancelScheduled: async (id) => {
    try {
      await axiosInstance.delete(`/messages/scheduled/${id}`);
      toast.success("Scheduled message canceled");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel");
      return false;
    }
  },

  setDisappearing: async (conversationId, minutes) => {
    try {
      await axiosInstance.post(`/messages/conversation/${conversationId}/disappearing`, { minutes });
      toast.success(minutes > 0 ? "Disappearing messages on" : "Disappearing messages off");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed");
    }
  },

  renameGroup: async (conversationId, name) => {
    try {
      await axiosInstance.patch(`/messages/conversation/${conversationId}`, { name });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to rename");
    }
  },

  // update group photo / description / posting permission (admins only)
  updateGroupInfo: async (conversationId, changes) => {
    try {
      await axiosInstance.patch(`/messages/conversation/${conversationId}`, changes);
      toast.success("Group updated");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
      return false;
    }
  },

  setGroupAdmin: async (conversationId, userId, makeAdmin) => {
    try {
      await axiosInstance.post(`/messages/conversation/${conversationId}/admin`, { userId, makeAdmin });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update admin");
    }
  },

  createInvite: async (conversationId, rotate = false) => {
    try {
      const res = await axiosInstance.post(
        `/messages/conversation/${conversationId}/invite`,
        {},
        { params: rotate ? { rotate: 1 } : {} }
      );
      return res.data.inviteCode;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create invite");
      return null;
    }
  },

  revokeInvite: async (conversationId) => {
    try {
      await axiosInstance.delete(`/messages/conversation/${conversationId}/invite`);
      toast.success("Invite link disabled");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to revoke invite");
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