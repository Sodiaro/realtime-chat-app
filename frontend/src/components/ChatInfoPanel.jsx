import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";
import { Users, Image as ImageIcon, Mic, AtSign } from "lucide-react";
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
  if (!selectedUser) return null;

  const isGroup = selectedUser.isGroup;
  const isOnline = onlineUsers.includes(selectedUser._id);
  const images = messages.filter((m) => m.image && !m.deletedAt);
  const voices = messages.filter((m) => m.audio && !m.deletedAt);

  const members = isGroup
    ? (selectedUser.participants || []).map((p) =>
        p?.fullName ? p : users.find((u) => u._id === (p?._id || p)) || { _id: p?._id || p, fullName: "Member" }
      )
    : [];

  return (
    <aside className="w-80 h-full flex flex-col bg-base-100 overflow-y-auto">
      <div className="p-6 text-center border-b border-base-300/50">
        {isGroup ? (
          <div className="size-20 rounded-3xl mx-auto grid place-items-center bg-primary/10 text-primary">
            <Users className="size-9" />
          </div>
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

      <div className="grid grid-cols-2 gap-3 p-4">
        <Stat icon={<ImageIcon className="size-4" />} label="Photos" value={images.length} tint="bg-teal-500/10" />
        <Stat icon={<Mic className="size-4" />} label="Voice" value={voices.length} tint="bg-amber-500/10" />
      </div>

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
    </aside>
  );
};

export default ChatInfoPanel;
