import { useState } from "react";
import { X, Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import Avatar from "./Avatar";

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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-base-100 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Share a contact</h3>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            autoFocus
            className="input input-sm input-bordered w-full pl-8"
            placeholder="Search contacts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="max-h-72 overflow-y-auto -mx-1">
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
      </div>
    </div>
  );
};

export default ContactPickerModal;
