import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import { Pin, Mic } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import ForwardModal from "./ForwardModal";
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

  useEffect(() => {
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

  useEffect(() => {
    if (messageEndRef.current && messages) {
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

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      {latestPinned && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-sm">
          <Pin className="size-4 text-amber-500 shrink-0" />
          <span className="flex-1 truncate">{latestPinned.text || "📷 Photo"}</span>
        </div>
      )}

      <ForwardModal />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message._id} ref={messageEndRef}>
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
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img src={selectedUser.profilePic || "/avatar.png"} alt="profile pic" />
              </div>
            </div>
            <div className="chat-bubble bg-base-200 flex items-center gap-1 py-3">
              <span className="size-2 rounded-full bg-base-content/40 animate-bounce [animation-delay:-0.3s]" />
              <span className="size-2 rounded-full bg-base-content/40 animate-bounce [animation-delay:-0.15s]" />
              <span className="size-2 rounded-full bg-base-content/40 animate-bounce" />
            </div>
          </div>
        )}

        {isRecordingPeer && (
          <div className="chat chat-start" ref={messageEndRef}>
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img src={selectedUser.profilePic || "/avatar.png"} alt="profile pic" />
              </div>
            </div>
            <div className="chat-bubble bg-base-200 flex items-center gap-2 text-sm text-base-content/70">
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