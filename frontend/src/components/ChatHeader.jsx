import { useState } from "react";
import { X, Search, Ban, Users, MoreVertical, BellOff, Bell, Archive, Info } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { axiosInstance } from "../lib/axios";
import { formatLastSeen, formatMessageTime } from "../lib/utils";
import GroupInfoModal from "./GroupInfoModal";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, conversations, toggleMute, toggleArchive } = useChatStore();
  const { onlineUsers, authUser, blockUser } = useAuthStore();
  const isGroup = selectedUser.isGroup;
  const isOnline = onlineUsers.includes(selectedUser._id);
  const isBlocked = !isGroup && authUser?.blockedUsers?.some((id) => id === selectedUser._id);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // the conversation backing this chat (groups use their own id; DMs match by participant)
  const conv = isGroup
    ? conversations.find((c) => c._id === selectedUser._id)
    : conversations.find(
        (c) => !c.isGroup && c.participants?.some((p) => (p._id || p) === selectedUser._id)
      );

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async (q) => {
    setQuery(q);
    if (!q.trim()) return setResults([]);
    setSearching(true);
    try {
      const res = await axiosInstance.get("/messages/search", {
        params: { q, with: selectedUser._id },
      });
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full relative grid place-items-center bg-base-300">
              {isGroup ? (
                <Users className="size-5" />
              ) : (
                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium">
              {selectedUser.fullName}
              {!isGroup && selectedUser.username && (
                <span className="ml-1.5 text-xs font-normal opacity-50">@{selectedUser.username}</span>
              )}
            </h3>
            <p className="text-sm text-base-content/70">
              {isGroup
                ? `${selectedUser.participants?.length || 0} members`
                : isBlocked
                  ? "Blocked"
                  : isOnline
                    ? selectedUser.status || "Online"
                    : formatLastSeen(selectedUser.lastSeen)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isGroup && (
            <button onClick={() => setSearchOpen((v) => !v)} title="Search messages">
              <Search className="size-5" />
            </button>
          )}
          {!isGroup && (
            <button
              onClick={() => blockUser(selectedUser._id)}
              title={isBlocked ? "Unblock user" : "Block user"}
              className={isBlocked ? "text-error" : ""}
            >
              <Ban className="size-5" />
            </button>
          )}

          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="px-1" title="More">
              <MoreVertical className="size-5" />
            </button>
            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box shadow w-48 z-50 mt-2">
              {isGroup && (
                <li>
                  <button onClick={() => setShowGroupInfo(true)}>
                    <Info className="size-4" /> Group info
                  </button>
                </li>
              )}
              {conv && (
                <li>
                  <button onClick={() => toggleMute(conv._id)}>
                    {conv.isMuted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                    {conv.isMuted ? "Unmute" : "Mute"}
                  </button>
                </li>
              )}
              {conv && (
                <li>
                  <button onClick={() => toggleArchive(conv._id)}>
                    <Archive className="size-4" />
                    {conv.isArchived ? "Unarchive" : "Archive"}
                  </button>
                </li>
              )}
            </ul>
          </div>

          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>

      {showGroupInfo && isGroup && (
        <GroupInfoModal conversation={selectedUser} onClose={() => setShowGroupInfo(false)} />
      )}

      {searchOpen && (
        <div className="mt-2 relative">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input input-sm input-bordered flex-1"
              placeholder={`Search in chat with ${selectedUser.fullName}…`}
              value={query}
              onChange={(e) => runSearch(e.target.value)}
            />
            <button onClick={closeSearch} className="btn btn-ghost btn-sm btn-circle">
              <X className="size-4" />
            </button>
          </div>

          {query.trim() && (
            <div className="mt-1 max-h-60 overflow-y-auto rounded-lg border border-base-300 bg-base-100">
              {searching ? (
                <p className="p-3 text-sm opacity-60">Searching…</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-sm opacity-60">No matches</p>
              ) : (
                results.map((m) => (
                  <div key={m._id} className="px-3 py-2 border-b border-base-200 last:border-0">
                    <p className="text-sm truncate">{m.text}</p>
                    <time className="text-xs opacity-50">{formatMessageTime(m.createdAt)}</time>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ChatHeader;
