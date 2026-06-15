import { X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const ForwardModal = () => {
  const { forwarding, setForwarding, forwardMessage, users } = useChatStore();
  if (!forwarding) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setForwarding(null)}
    >
      <div
        className="bg-base-100 rounded-xl w-80 max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h3 className="font-medium">Forward to…</h3>
          <button onClick={() => setForwarding(null)}>
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {users.length === 0 && <p className="p-4 text-sm opacity-60">No users</p>}
          {users.map((u) => (
            <button
              key={u._id}
              onClick={() => forwardMessage(forwarding._id, u._id)}
              className="flex items-center gap-3 w-full p-3 hover:bg-base-200"
            >
              <img
                src={u.profilePic || "/avatar.png"}
                alt={u.fullName}
                className="size-9 rounded-full"
              />
              <span className="truncate">{u.fullName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
