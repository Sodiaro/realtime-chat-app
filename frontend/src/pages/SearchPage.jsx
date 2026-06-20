import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import Avatar from "../components/Avatar";
import { Search, UsersRound } from "lucide-react";
import { formatMessageTime } from "../lib/utils";

const SearchPage = () => {
  const { authUser } = useAuthStore();
  const { conversations, setSelectedUser } = useChatStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // debounced global search across every chat (all setState lives in the timer,
  // never synchronously in the effect body)
  useEffect(() => {
    const term = q.trim();
    let active = true;
    const t = setTimeout(async () => {
      if (!term) {
        if (active) setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await axiosInstance.get("/messages/search", { params: { q: term } });
        if (active) setResults(res.data);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  if (!authUser) return <Navigate to="/login" />;

  // map a matched message back to the chat it belongs to (peer DM or group)
  const resolve = (m) => {
    const conv = conversations.find((c) => c._id === m.conversationId);
    if (!conv) return null;
    if (conv.isGroup) return { target: { ...conv, fullName: conv.name }, title: conv.name, group: true };
    const peer = conv.participants?.find((p) => (p._id || p) !== authUser._id);
    return peer ? { target: peer, title: peer.fullName, group: false } : null;
  };

  const open = (m) => {
    const r = resolve(m);
    if (!r) return;
    setSelectedUser(r.target);
    navigate("/");
  };

  return (
    <div className="max-w-2xl mx-auto pt-24 px-4 pb-10">
      <h1 className="text-2xl font-bold mb-3 flex items-center gap-2">
        <Search className="size-6" /> Search messages
      </h1>

      <div className="relative mb-4">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        <input
          autoFocus
          className="input input-bordered w-full pl-9"
          placeholder="Search across all your chats…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="opacity-60">Searching…</p>
      ) : q.trim() && results.length === 0 ? (
        <p className="opacity-60">No matches</p>
      ) : (
        <div className="space-y-1">
          {results.map((m) => {
            const r = resolve(m);
            return (
              <button
                key={m._id}
                onClick={() => open(m)}
                disabled={!r}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 text-left disabled:opacity-40"
              >
                {r?.group ? (
                  <div className="size-10 rounded-full bg-base-300 grid place-items-center shrink-0">
                    <UsersRound className="size-5" />
                  </div>
                ) : (
                  <Avatar user={r?.target} size="size-10" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{r?.title || "Unknown chat"}</span>
                    <time className="text-xs opacity-50 shrink-0">{formatMessageTime(m.createdAt)}</time>
                  </div>
                  <div className="text-sm opacity-70 truncate">{m.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
