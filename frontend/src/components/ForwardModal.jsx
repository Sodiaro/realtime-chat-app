import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Avatar from "./Avatar";

// forward to any conversation — direct chats or groups
const ForwardModal = () => {
  const { forwarding, setForwarding, forwardMessage, users, conversations } = useChatStore();
  const [q, setQ] = useState("");

  const groups = useMemo(() => conversations.filter((c) => c.isGroup), [conversations]);

  const term = q.trim().toLowerCase();
  const people = term ? users.filter((u) => u.fullName?.toLowerCase().includes(term)) : users;
  const grps = term ? groups.filter((g) => g.name?.toLowerCase().includes(term)) : groups;

  if (!forwarding) return null;

  const Row = ({ onClick, avatar, label }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-base-200 text-left"
    >
      {avatar}
      <span className="truncate font-medium">{label}</span>
    </button>
  );

  return (
    <Modal title="Forward to…" onClose={() => setForwarding(null)} size="sm">
      <Input
        autoFocus
        icon={Search}
        size="sm"
        placeholder="Search people and groups…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />
      <div className="-mx-1 max-h-80 overflow-y-auto">
        {people.length === 0 && grps.length === 0 && (
          <p className="p-3 text-sm opacity-60 text-center">No matches</p>
        )}

        {grps.length > 0 && (
          <>
            <p className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-wide opacity-50">Groups</p>
            {grps.map((g) => (
              <Row
                key={g._id}
                onClick={() => forwardMessage(forwarding._id, { conversationId: g._id })}
                avatar={<Avatar group src={g.avatar} name={g.name} size="size-9" />}
                label={g.name}
              />
            ))}
          </>
        )}

        {people.length > 0 && (
          <>
            <p className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide opacity-50">People</p>
            {people.map((u) => (
              <Row
                key={u._id}
                onClick={() => forwardMessage(forwarding._id, { to: u._id })}
                avatar={<Avatar user={u} size="size-9" />}
                label={u.fullName}
              />
            ))}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ForwardModal;
