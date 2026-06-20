import { AtSign } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { formatLastSeen } from "../lib/utils";
import Avatar from "./Avatar";
import Modal from "./ui/Modal";

const UserProfileModal = ({ user, onClose }) => {
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(user._id);

  return (
    <Modal title="Profile" onClose={onClose} size="sm">
      <div className="flex flex-col items-center gap-3 text-center pt-1 pb-2">
        <Avatar user={user} size="size-24" className="ring-2 ring-base-300/60" />
        <div>
          <h2 className="text-lg font-semibold">{user.fullName}</h2>
          {user.username && (
            <p className="text-sm opacity-60 flex items-center justify-center gap-0.5">
              <AtSign className="size-3.5" />
              {user.username}
            </p>
          )}
        </div>
        <span
          className={`text-sm inline-flex items-center gap-1.5 ${isOnline ? "text-success" : "opacity-60"}`}
        >
          {isOnline && <span className="size-2 rounded-full bg-success" />}
          {isOnline ? "Online" : formatLastSeen(user.lastSeen)}
        </span>
        {user.status && <p className="text-sm italic opacity-80">“{user.status}”</p>}
        {user.bio && <p className="text-sm opacity-70 max-w-[16rem]">{user.bio}</p>}
      </div>
    </Modal>
  );
};

export default UserProfileModal;
