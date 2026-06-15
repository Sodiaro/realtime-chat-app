import { X, AtSign } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { formatLastSeen } from "../lib/utils";
import Avatar from "./Avatar";

const UserProfileModal = ({ user, onClose }) => {
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(user._id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl w-80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h3 className="font-medium">Profile</h3>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-3 text-center">
          <Avatar user={user} size="size-24" className="border" />
          <div>
            <h2 className="text-lg font-semibold">{user.fullName}</h2>
            {user.username && (
              <p className="text-sm opacity-60 flex items-center justify-center gap-0.5">
                <AtSign className="size-3.5" />
                {user.username}
              </p>
            )}
          </div>
          <span className={`text-sm ${isOnline ? "text-success" : "opacity-60"}`}>
            {isOnline ? "Online" : formatLastSeen(user.lastSeen)}
          </span>
          {user.status && <p className="text-sm italic opacity-80">“{user.status}”</p>}
          {user.bio && <p className="text-sm opacity-70">{user.bio}</p>}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
