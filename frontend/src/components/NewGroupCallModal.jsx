import { useState } from "react";
import { Phone, Video, Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useGroupCallStore } from "../store/useGroupCallStore";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Avatar from "./Avatar";

// pick several contacts and ring them all at once (no group required)
const NewGroupCallModal = ({ onClose }) => {
  const { users } = useChatStore();
  const { startGroupCall } = useGroupCallStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);

  const term = q.trim().toLowerCase();
  const list = term ? users.filter((u) => u.fullName?.toLowerCase().includes(term)) : users;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const start = (video) => {
    if (selected.length === 0) return;
    startGroupCall({ invitees: selected, video, title: "Group call" });
    onClose();
  };

  return (
    <Modal
      title="New group call"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button onClick={() => start(false)} disabled={!selected.length} className="btn btn-sm btn-primary gap-1">
            <Phone className="size-4" /> Voice
          </button>
          <button onClick={() => start(true)} disabled={!selected.length} className="btn btn-sm btn-primary gap-1">
            <Video className="size-4" /> Video
          </button>
        </>
      }
    >
      <Input
        autoFocus
        icon={Search}
        size="sm"
        placeholder="Search contacts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-2"
      />
      <p className="text-xs opacity-60 mb-2">{selected.length} selected</p>
      <div className="-mx-1 max-h-72 overflow-y-auto">
        {list.length === 0 && <p className="p-3 text-sm opacity-60 text-center">No contacts</p>}
        {list.map((u) => (
          <label key={u._id} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-base-200 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected.includes(u._id)}
              onChange={() => toggle(u._id)}
            />
            <Avatar user={u} size="size-9" />
            <span className="truncate font-medium">{u.fullName}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
};

export default NewGroupCallModal;
