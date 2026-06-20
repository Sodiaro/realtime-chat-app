import { useChatStore } from "../store/useChatStore";
import Modal from "./ui/Modal";
import Avatar from "./Avatar";

const ForwardModal = () => {
  const { forwarding, setForwarding, forwardMessage, users } = useChatStore();
  if (!forwarding) return null;

  return (
    <Modal title="Forward to…" onClose={() => setForwarding(null)} size="sm">
      <div className="-m-1">
        {users.length === 0 && <p className="p-3 text-sm opacity-60 text-center">No contacts</p>}
        {users.map((u) => (
          <button
            key={u._id}
            onClick={() => forwardMessage(forwarding._id, u._id)}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-base-200 text-left"
          >
            <Avatar user={u} size="size-9" />
            <span className="truncate font-medium">{u.fullName}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
};

export default ForwardModal;
