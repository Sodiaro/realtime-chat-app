import { useState } from "react";
import { Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import Avatar from "./Avatar";
import Modal from "./ui/Modal";
import Input from "./ui/Input";

// Pick one of your contacts to share as a card in the current chat.
const ContactPickerModal = ({ onClose, onPick }) => {
  const { users } = useChatStore();
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const filtered = term
    ? users.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term)
      )
    : users;

  return (
    <Modal title="Share a contact" onClose={onClose} size="sm">
      <Input
        autoFocus
        icon={Search}
        size="sm"
        placeholder="Search contacts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />

      <div className="-mx-1 max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm opacity-60 p-3 text-center">No contacts</p>
        ) : (
          filtered.map((u) => (
            <button
              key={u._id}
              onClick={() => onPick(u)}
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

export default ContactPickerModal;
