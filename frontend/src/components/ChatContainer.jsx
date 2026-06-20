import { useChatStore } from "../store/useChatStore";
import { useChatBgStore, bgClass } from "../store/useChatBgStore";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pin, Mic, ChevronDown, Loader2 } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import ForwardModal from "./ForwardModal";
import Avatar from "./Avatar";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";

const SAME_GROUP_MS = 5 * 60 * 1000; // group consecutive messages within 5 minutes

const dayLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
};

const ChatContainer = () => {
  const {
    messages, getMessages, isMessagesLoading, selectedUser,
    subscribeToMessages, unsubscribeFromMessages, isTyping, isRecordingPeer,
    markMessagesRead, users, nextCursor, isLoadingOlder, loadOlderMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const { bg } = useChatBgStore();

  const scrollRef = useRef(null);
  const messageEndRef = useRef(null);
  const prevCountRef = useRef(0);
  const atBottomRef = useRef(true);
  const pinIndexRef = useRef(0);
  const isFetchingOlderRef = useRef(false);
  const restoreHeightRef = useRef(null);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    prevCountRef.current = 0; // reset so the first load scrolls to bottom
    atBottomRef.current = true;
    getMessages(selectedUser._id);
    subscribeToMessages();
    markMessagesRead();
    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages, markMessagesRead]);

  // auto-scroll only when the user is already at the bottom (or it's the first load)
  useEffect(() => {
    const grew = messages.length > prevCountRef.current;
    const first = prevCountRef.current === 0;
    prevCountRef.current = messages.length;
    if ((first || ((grew || isTyping || isRecordingPeer) && atBottomRef.current)) && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: first ? "auto" : "smooth" });
    }
  }, [messages, isTyping, isRecordingPeer]);

  // announce incoming (non-own) messages politely for screen readers
  const liveRef = useRef(null);
  const lastAnnouncedRef = useRef(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last._id === lastAnnouncedRef.current) return;
    lastAnnouncedRef.current = last._id;
    if (last.senderId !== authUser._id && !last.deletedAt && liveRef.current) {
      liveRef.current.textContent = `New message: ${last.text || "media attachment"}`;
    }
  }, [messages, authUser._id]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = dist < 120;
    setShowJump(dist > 320);

    // near the top → fetch an older page, remembering height to restore position
    if (el.scrollTop < 80 && nextCursor && !isFetchingOlderRef.current) {
      isFetchingOlderRef.current = true;
      restoreHeightRef.current = el.scrollHeight;
      loadOlderMessages().finally(() => {
        isFetchingOlderRef.current = false;
      });
    }
  };

  // after older messages prepend, keep the viewport on the same message
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && restoreHeightRef.current != null) {
      const delta = el.scrollHeight - restoreHeightRef.current;
      if (delta > 0) el.scrollTop += delta;
      restoreHeightRef.current = null;
    }
  }, [messages]);

  const scrollToBottom = () => messageEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // dedupe by id (O(n), latest wins), then compute grouping + day dividers in one pass
  const rows = useMemo(() => {
    const byId = new Map();
    messages.forEach((m) => byId.set(m._id, m));
    const ordered = [...byId.values()];
    const out = [];
    let lastDay = null;
    ordered.forEach((m, i) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ type: "divider", key: `d-${day}`, label: dayLabel(m.createdAt) });
        lastDay = day;
      }
      const prev = ordered[i - 1];
      const grouped =
        !!prev &&
        prev.senderId === m.senderId &&
        !prev.deletedAt &&
        new Date(prev.createdAt).toDateString() === day &&
        new Date(m.createdAt) - new Date(prev.createdAt) < SAME_GROUP_MS;
      out.push({ type: "msg", key: m._id, m, grouped });
    });
    return out;
  }, [messages]);

  const pinned = messages.filter((m) => m.pinnedAt && !m.deletedAt);
  const latestPinned = pinned[pinned.length - 1];
  const pinPreview = (m) =>
    m.text || (m.image ? "📷 Photo" : m.file ? "📎 File" : m.audio ? "🎤 Voice note" : m.poll ? "📊 Poll" : "Message");

  const jumpToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-base-200", "rounded-xl");
    setTimeout(
      () => el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-base-200", "rounded-xl"),
      1600
    );
  };
  const handlePinnedClick = () => {
    if (!pinned.length) return;
    const target = pinned[pinIndexRef.current % pinned.length];
    pinIndexRef.current = (pinIndexRef.current + 1) % pinned.length;
    jumpToMessage(target._id);
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader />
      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {latestPinned && (
        <button
          onClick={handlePinnedClick}
          className="w-full flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-sm text-left hover:bg-warning/20 transition-colors"
          title="Jump to pinned message"
        >
          <Pin className="size-4 text-warning shrink-0" />
          <span className="flex-1 truncate">{pinPreview(latestPinned)}</span>
          {pinned.length > 1 && <span className="text-xs opacity-60 shrink-0">{pinned.length} pinned</span>}
        </button>
      )}

      <ForwardModal />

      <div ref={scrollRef} onScroll={onScroll} className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-5 ${bgClass(bg)}`}>
        {isLoadingOlder && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-5 animate-spin text-base-content/40" />
          </div>
        )}
        {rows.map((row) =>
          row.type === "divider" ? (
            <div key={row.key} className="flex items-center justify-center my-5">
              <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-base-100 border border-base-300/70 text-base-content/60 shadow-soft">
                {row.label}
              </span>
            </div>
          ) : (
            <div
              key={row.key}
              id={`msg-${row.m._id}`}
              className={row.grouped ? "mt-0.5" : "mt-4 first:mt-0"}
            >
              <MessageBubble
                message={row.m}
                isOwn={row.m.senderId === authUser._id}
                authUser={authUser}
                selectedUser={selectedUser}
                users={users}
                grouped={row.grouped}
              />
            </div>
          )
        )}

        {isTyping && (
          <div className="chat chat-start mt-4">
            <div className="chat-image">
              <Avatar user={selectedUser} size="size-10" />
            </div>
            <div className="chat-bubble rounded-2xl !bg-base-100 ring-1 ring-base-300/60 shadow-sm flex items-center gap-1 py-3">
              <span className="size-2 rounded-full bg-base-content/40 animate-bounce [animation-delay:-0.3s]" />
              <span className="size-2 rounded-full bg-base-content/40 animate-bounce [animation-delay:-0.15s]" />
              <span className="size-2 rounded-full bg-base-content/40 animate-bounce" />
            </div>
          </div>
        )}

        {isRecordingPeer && (
          <div className="chat chat-start mt-4">
            <div className="chat-image">
              <Avatar user={selectedUser} size="size-10" />
            </div>
            <div className="chat-bubble rounded-2xl !bg-base-100 ring-1 ring-base-300/60 shadow-sm flex items-center gap-2 text-sm text-base-content/70">
              <Mic className="size-4 text-error animate-pulse" />
              recording a voice note…
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {showJump && (
        <button
          onClick={scrollToBottom}
          aria-label="Jump to latest"
          className="absolute bottom-24 right-5 btn btn-circle btn-sm bg-base-100 border border-base-300 shadow-pop hover:bg-base-200 z-10 animate-fade-in"
        >
          <ChevronDown className="size-5" />
        </button>
      )}

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
