import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useCommunityStore } from "../store/useCommunityStore";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Avatar from "./Avatar";

// browse + join communities you're not a member of yet
const DiscoverCommunitiesModal = ({ onClose, onJoined }) => {
  const { discover, joinCommunity } = useCommunityStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await discover(q.trim());
      if (active) {
        setResults(r);
        setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, discover]);

  const join = async (id) => {
    setJoining(id);
    await joinCommunity(id);
    setJoining(null);
    onJoined?.(id);
    onClose();
  };

  return (
    <Modal title="Discover communities" onClose={onClose} size="sm">
      <Input
        autoFocus
        icon={Search}
        size="sm"
        placeholder="Search communities…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />
      <div className="-mx-1 max-h-80 overflow-y-auto">
        {loading ? (
          <p className="p-3 text-sm opacity-60 text-center">Searching…</p>
        ) : results.length === 0 ? (
          <p className="p-3 text-sm opacity-60 text-center">
            {q.trim() ? "No communities match your search" : "No communities to discover yet"}
          </p>
        ) : (
          results.map((c) => (
            <div key={c._id} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-base-200">
              <Avatar group src={c.avatar} name={c.name} size="size-10" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs opacity-60 truncate">
                  {c.memberCount} member{c.memberCount > 1 ? "s" : ""} · {c.groupCount} group
                  {c.groupCount === 1 ? "" : "s"}
                  {c.description ? ` · ${c.description}` : ""}
                </div>
              </div>
              <button onClick={() => join(c._id)} disabled={joining === c._id} className="btn btn-sm btn-primary">
                {joining === c._id ? "Joining…" : "Join"}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

export default DiscoverCommunitiesModal;
