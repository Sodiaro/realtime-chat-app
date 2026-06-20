import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";
import SharedMediaModal from "./SharedMediaModal";
import { Image as ImageIcon, Mic, AtSign, FolderOpen } from "lucide-react";
import { formatLastSeen } from "../lib/utils";

const Stat = ({ icon, label, value, tint }) => (
  <div className={`rounded-2xl p-3 ${tint}`}>
    <div className="flex items-center gap-2 text-sm opacity-70">
      {icon}
      {label}
    </div>
    <div className="text-xl font-semibold mt-1">{value}</div>
  </div>
);

const ChatInfoPanel = () => {
  const { selectedUser, messages, users } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showShared, setShowShared] = useState(false);
  if (!selectedUser) return null;

  const isGroup = selectedUser.isGroup;
  const isOnline = onlineUsers.includes(selectedUser._id);
  const images = messages.filter((m) => m.image && !m.deletedAt);
  const voices = messages.filter((m) => m.audio && !m.deletedAt);
  // group id is the conversation id; for DMs read it off a loaded message
  const conversationId = isGroup ? selectedUser._id : messages.find((m) => m.conversationId)?.conversationId;

  const members = isGroup
    ? (selectedUser.participants || []).map((p) =>
        p?.fullName ? p : users.find((u) => u._id === (p?._id || p)) || { _id: p?._id || p, fullName: "Member" }
      )
    : [];

  return (
    <aside className="w-80 h-full flex flex-col bg-base-100 overflow-y-auto">
      <div className="p-6 text-center border-b border-base-300/50">
        {isGroup ? (
          <Avatar group src={selectedUser.avatar} name={selectedUser.fullName} size="size-20" className="mx-auto" />
        ) : (
          <Avatar user={selectedUser} size="size-20" className="mx-auto" />
        )}
        <h3 className="font-semibold text-lg mt-3">{selectedUser.fullName}</h3>
        {!isGroup && selectedUser.username && (
          <p className="text-sm opacity-50 flex items-center justify-center gap-0.5">
            <AtSign className="size-3.5" />
            {selectedUser.username}
          </p>
        )}
        <p className="text-sm text-primary mt-1">
          {isGroup
            ? `${members.length} members`
            : isOnline
              ? "Online"
              : formatLastSeen(selectedUser.lastSeen)}
        </p>
        {!isGroup && selectedUser.status && (
          <p className="text-sm italic opacity-70 mt-1">“{selectedUser.status}”</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 pb-2">
        <Stat icon={<ImageIcon className="size-4" />} label="Photos" value={images.length} tint="bg-teal-500/10" />
        <Stat icon={<Mic className="size-4" />} label="Voice" value={voices.length} tint="bg-amber-500/10" />
      </div>

      {conversationId && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowShared(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-base-300 px-3 py-2.5 text-sm hover:bg-base-200 transition-colors"
          >
            <FolderOpen className="size-4 text-primary" />
            View shared media, files & links
          </button>
        </div>
      )}

      {images.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs uppercase opacity-50 mb-2">Shared photos</p>
          <div className="grid grid-cols-3 gap-1.5">
            {images.slice(-9).reverse().map((m) => (
              <img
                key={m._id}
                src={m.image}
                alt=""
                className="aspect-square w-full object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}

      {isGroup && (
        <div className="px-4 pb-6">
          <p className="text-xs uppercase opacity-50 mb-2">Members</p>
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m._id} className="flex items-center gap-2 py-1">
                <Avatar user={m} size="size-8" />
                <span className="text-sm truncate">{m.fullName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showShared && conversationId && (
        <SharedMediaModal conversationId={conversationId} onClose={() => setShowShared(false)} />
      )}
    </aside>
  );
};

export default ChatInfoPanel;
