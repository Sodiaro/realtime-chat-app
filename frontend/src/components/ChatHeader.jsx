import { useState } from "react";
import { X, Search } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { axiosInstance } from "../lib/axios";
import { formatLastSeen, formatMessageTime } from "../lib/utils";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(selectedUser._id);

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
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {isOnline ? "Online" : formatLastSeen(selectedUser.lastSeen)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen((v) => !v)} title="Search messages">
            <Search className="size-5" />
          </button>
          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>

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
