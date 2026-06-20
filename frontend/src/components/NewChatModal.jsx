import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import Avatar from "./Avatar";
import Modal from "./ui/Modal";
import Input from "./ui/Input";

// Find a person by name/username and start a direct chat with them.
const NewChatModal = ({ onClose }) => {
  const { searchUsers, setSelectedUser } = useChatStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    let active = true;
    const t = setTimeout(async () => {
      if (!term) {
        if (active) setResults([]);
        return;
      }
      setLoading(true);
      const r = await searchUsers(term);
      if (active) {
        setResults(r);
        setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, searchUsers]);

  const pick = (u) => {
    setSelectedUser(u);
    onClose();
  };

  return (
    <Modal title="New chat" onClose={onClose} size="sm">
      <Input
        autoFocus
        icon={Search}
        size="sm"
        placeholder="Search people by name or @username…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />
      <div className="-mx-1 max-h-72 overflow-y-auto">
        {loading ? (
          <p className="text-sm opacity-60 p-3 text-center">Searching…</p>
        ) : !q.trim() ? (
          <p className="text-sm opacity-60 p-3 text-center">Find people to start a conversation</p>
        ) : results.length === 0 ? (
          <p className="text-sm opacity-60 p-3 text-center">No users found</p>
        ) : (
          results.map((u) => (
            <button
              key={u._id}
              onClick={() => pick(u)}
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-base-200 text-left"
            >
              <Avatar user={u} size="size-10" />
              <div className="min-w-0">
                <div className="font-medium truncate">{u.fullName}</div>
                {u.username && <div className="text-xs opacity-60 truncate">@{u.username}</div>}
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
};

export default NewChatModal;
