import { useChatStore } from "../../store/useChatStore";
import { usePanelStore } from "../../store/usePanelStore";
import Avatar from "../Avatar";

// all of the user's contacts; tapping one opens that conversation
const ContactsPanel = () => {
  const { users, setSelectedUser } = useChatStore();
  const { closePanel } = usePanelStore();

  const open = (u) => {
    setSelectedUser(u);
    closePanel();
  };

  const sorted = [...users].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));

  if (sorted.length === 0)
    return (
      <p className="p-8 opacity-60 text-center text-sm">
        No contacts yet. Use “New chat” to find people.
      </p>
    );

  return (
    <div className="space-y-1">
      <p className="px-1 pb-1 text-xs uppercase tracking-wide opacity-50">
        {sorted.length} {sorted.length === 1 ? "contact" : "contacts"}
      </p>
      {sorted.map((u) => (
        <button
          key={u._id}
          onClick={() => open(u)}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-base-200 text-left"
        >
          <Avatar user={u} size="size-11" />
          <div className="min-w-0">
            <div className="font-medium truncate">{u.fullName}</div>
            {u.username && <div className="text-xs opacity-60 truncate">@{u.username}</div>}
          </div>
        </button>
      ))}
    </div>
  );
};

export default ContactsPanel;
