import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import { Pin, Mic } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import ForwardModal from "./ForwardModal";
import Avatar from "./Avatar";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    isTyping,
    isRecordingPeer,
    markMessagesRead,
    users,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const prevCountRef = useRef(0);
  const pinIndexRef = useRef(0);

  // scroll a message into view and flash a highlight ring
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

  useEffect(() => {
    prevCountRef.current = 0; // reset so the first load scrolls to bottom
    getMessages(selectedUser._id);

    subscribeToMessages();
    markMessagesRead(); // opening the chat marks their messages as seen

    return () => unsubscribeFromMessages();
  }, [
    selectedUser._id,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
    markMessagesRead,
  ]);

  // only scroll on a NEW message (or typing) — not on edits/reactions/reads,
  // which would otherwise jump the view to the bottom and feel like a "resend"
  useEffect(() => {
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if ((grew || isTyping || isRecordingPeer) && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isRecordingPeer]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const pinned = messages.filter((m) => m.pinnedAt && !m.deletedAt);
  const latestPinned = pinned[pinned.length - 1];

  const pinPreview = (m) =>
    m.text || (m.image ? "📷 Photo" : m.file ? "📎 File" : m.audio ? "🎤 Voice note" : m.poll ? "📊 Poll" : "Message");

  // jump to the next pinned message each click (cycles through them)
  const handlePinnedClick = () => {
    if (pinned.length === 0) return;
    const target = pinned[pinIndexRef.current % pinned.length];
    pinIndexRef.current = (pinIndexRef.current + 1) % pinned.length;
    jumpToMessage(target._id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      {latestPinned && (
        <button
          onClick={handlePinnedClick}
          className="w-full flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-sm text-left hover:bg-amber-500/20 transition-colors"
          title="Jump to pinned message"
        >
          <Pin className="size-4 text-amber-500 shrink-0" />
          <span className="flex-1 truncate">{pinPreview(latestPinned)}</span>
          {pinned.length > 1 && (
            <span className="text-xs opacity-60 shrink-0">{pinned.length} pinned</span>
          )}
        </button>
      )}

      <ForwardModal />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-200/40">
        {Object.values(
          messages.reduce((acc, m) => ({ ...acc, [m._id]: m }), {})
        ).map((message) => (
          <div key={message._id} id={`msg-${message._id}`} ref={messageEndRef}>
            <MessageBubble
              message={message}
              isOwn={message.senderId === authUser._id}
              authUser={authUser}
              selectedUser={selectedUser}
              users={users}
            />
          </div>
        ))}

        {isTyping && (
          <div className="chat chat-start" ref={messageEndRef}>
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
          <div className="chat chat-start" ref={messageEndRef}>
            <div className="chat-image">
              <Avatar user={selectedUser} size="size-10" />
            </div>
            <div className="chat-bubble rounded-2xl !bg-base-100 ring-1 ring-base-300/60 shadow-sm flex items-center gap-2 text-sm text-base-content/70">
              <Mic className="size-4 text-red-500 animate-pulse" />
              recording a voice note…
            </div>
          </div>
        )}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;