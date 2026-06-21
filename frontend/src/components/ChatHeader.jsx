import { useState } from "react";
import { X, Search, Ban, MoreVertical, BellOff, Bell, Archive, Info, UserRound, Timer, Phone, Video, Pin, ArrowLeft, Ghost } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { axiosInstance } from "../lib/axios";
import { formatLastSeen, formatMessageTime } from "../lib/utils";
import GroupInfoModal from "./GroupInfoModal";
import UserProfileModal from "./UserProfileModal";
import Avatar from "./Avatar";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, conversations, toggleMute, toggleArchive, togglePin, setDisappearing } =
    useChatStore();
  const { onlineUsers, authUser, blockUser } = useAuthStore();
  const isGroup = selectedUser.isGroup;
  const isSelf = selectedUser.isSelf;
  const isOnline = onlineUsers.includes(selectedUser._id);
  const isBlocked = !isGroup && authUser?.blockedUsers?.some((id) => id === selectedUser._id);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { startCall } = useCallStore();

  // the conversation backing this chat (groups use their own id; DMs match by participant)
  const conv = isGroup
    ? conversations.find((c) => c._id === selectedUser._id)
    : isSelf
      ? conversations.find(
          (c) => !c.isGroup && c.participants?.every((p) => (p._id || p) === selectedUser._id)
        )
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
    <div className="p-3.5 border-b border-base-300">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => setSelectedUser(null)}
            aria-label="Back to chats"
            className="btn btn-ghost btn-sm btn-circle md:hidden -ml-1 shrink-0"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div
            className={`flex items-center gap-3 min-w-0 ${!isGroup ? "cursor-pointer" : ""}`}
            onClick={() => !isGroup && setShowProfile(true)}
          >
          {isGroup ? (
            <Avatar group src={selectedUser.avatar} name={selectedUser.fullName} size="size-12" />
          ) : (
            <Avatar user={selectedUser} size="size-12" />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-lg font-semibold leading-tight truncate">{selectedUser.fullName}</h3>
              {conv?.disappearMinutes > 0 && (
                <Timer className="size-4 text-primary shrink-0" title="Disappearing messages are on" />
              )}
              {!isGroup && !isSelf && selectedUser.ghostMode && (
                <span
                  className="badge badge-sm gap-1 shrink-0 border-base-300"
                  title="This person has Ghost Mode on — read receipts, last seen, status views and edit/delete indicators may be hidden"
                >
                  <Ghost className="size-3" /> Ghost
                </span>
              )}
            </div>
            <p className={`text-sm ${isOnline && !isGroup && !isSelf ? "text-success" : "text-base-content/60"}`}>
              {isSelf
                ? "Message yourself"
                : isGroup
                  ? `${selectedUser.participants?.length || 0} members`
                  : isBlocked
                    ? "Blocked"
                    : isOnline
                      ? "Online"
                      : formatLastSeen(selectedUser.lastSeen)}
            </p>
          </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isGroup && !isSelf && (
            <button
              onClick={() => startCall(selectedUser, false)}
              title="Voice call"
              aria-label="Voice call"
              className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-base-content"
            >
              <Phone className="size-5" />
            </button>
          )}
          {!isGroup && (
            <button
              onClick={() => setSearchOpen((v) => !v)}
              title="Search messages"
              aria-label="Search messages"
              className={`btn btn-ghost btn-sm btn-circle ${
                searchOpen ? "text-primary bg-primary/10" : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <Search className="size-5" />
            </button>
          )}

          <div className="dropdown dropdown-end">
            <button
              tabIndex={0}
              title="More options"
              aria-label="More options"
              className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-base-content"
            >
              <MoreVertical className="size-5" />
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-100 rounded-2xl shadow-pop border border-base-300/60 w-64 z-50 mt-2 p-1.5 gap-0.5 [&_li>button]:gap-3 [&_li>button]:rounded-lg [&_li>button]:py-2.5 [&_li>button]:text-sm [&_li>button>svg]:opacity-70"
            >
              {/* identity + quick action */}
              {isGroup ? (
                <li>
                  <button onClick={() => setShowGroupInfo(true)}>
                    <Info className="size-4 shrink-0" /> Group info
                  </button>
                </li>
              ) : (
                <li>
                  <button onClick={() => setShowProfile(true)}>
                    <UserRound className="size-4 shrink-0" /> View profile
                  </button>
                </li>
              )}
              {!isGroup && !isSelf && (
                <li>
                  <button onClick={() => startCall(selectedUser, true)}>
                    <Video className="size-4 shrink-0" /> Video call
                  </button>
                </li>
              )}

              {/* conversation settings */}
              {conv && (
                <>
                  <div className="h-px bg-base-300/60 mx-2 my-1" />
                  <li>
                    <button onClick={() => toggleMute(conv._id)}>
                      {conv.isMuted ? <Bell className="size-4 shrink-0" /> : <BellOff className="size-4 shrink-0" />}
                      {conv.isMuted ? "Unmute" : "Mute"}
                    </button>
                  </li>
                  <li>
                    <button onClick={() => togglePin(conv._id)}>
                      <Pin className="size-4 shrink-0" />
                      {conv.isPinned ? "Unpin" : "Pin to top"}
                    </button>
                  </li>
                  <li>
                    <button onClick={() => toggleArchive(conv._id)}>
                      <Archive className="size-4 shrink-0" />
                      {conv.isArchived ? "Unarchive" : "Archive"}
                    </button>
                  </li>

                  <li className="menu-title flex-row items-center gap-2 px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide opacity-50">
                    <Timer className="size-3.5" /> Disappearing
                  </li>
                  <li className="px-2 pb-1">
                    <div className="flex gap-1 bg-base-200/60 rounded-lg p-1 hover:bg-base-200/60">
                      {[
                        { l: "Off", m: 0 },
                        { l: "1 day", m: 1440 },
                        { l: "1 week", m: 10080 },
                      ].map((o) => (
                        <button
                          key={o.m}
                          onClick={() => setDisappearing(conv._id, o.m)}
                          className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                            (conv.disappearMinutes || 0) === o.m
                              ? "bg-primary text-primary-content"
                              : "hover:bg-base-300"
                          }`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </li>
                </>
              )}

              {/* exit + destructive */}
              <div className="h-px bg-base-300/60 mx-2 my-1" />
              <li>
                <button onClick={() => setSelectedUser(null)}>
                  <X className="size-4 shrink-0" /> Close chat
                </button>
              </li>
              {!isGroup && (
                <li>
                  <button
                    onClick={() => blockUser(selectedUser._id)}
                    className="!text-error hover:!bg-error/10"
                  >
                    <Ban className="size-4 shrink-0" />
                    {isBlocked ? "Unblock user" : "Block user"}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {showGroupInfo && isGroup && (
        <GroupInfoModal conversation={selectedUser} onClose={() => setShowGroupInfo(false)} />
      )}
      {showProfile && !isGroup && (
        <UserProfileModal user={selectedUser} onClose={() => setShowProfile(false)} />
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
