import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import CreateGroupModal from "./CreateGroupModal";
import { Users, UsersRound, Plus, BellOff, Archive } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    conversations,
    getConversations,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    getUsers();
    getConversations();
  }, [getUsers, getConversations]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  const convForUser = (userId) =>
    conversations.find((c) => !c.isGroup && c.participants?.some((p) => (p._id || p) === userId));
  const lastAt = (conv) => (conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0);

  // groups + DMs, newest activity first
  const groups = conversations
    .filter((c) => c.isGroup)
    .sort((a, b) => lastAt(b) - lastAt(a));
  const usersWithConv = filteredUsers
    .map((u) => ({ u, conv: convForUser(u._id) }))
    .sort((a, b) => lastAt(b.conv) - lastAt(a.conv));

  const activeGroups = groups.filter((g) => !g.isArchived);
  const archivedGroups = groups.filter((g) => g.isArchived);
  const activeUsers = usersWithConv.filter((x) => !x.conv?.isArchived);
  const archivedUsers = usersWithConv.filter((x) => x.conv?.isArchived);
  const archivedCount = archivedGroups.length + archivedUsers.length;

  const Badge = ({ count }) =>
    count > 0 ? (
      <span className="ml-auto badge badge-primary badge-sm">{count > 99 ? "99+" : count}</span>
    ) : null;

  const GroupRow = (c) => (
    <button
      key={c._id}
      onClick={() => setSelectedUser({ ...c, fullName: c.name })}
      className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors ${
        selectedUser?._id === c._id ? "bg-base-300 ring-1 ring-base-300" : ""
      }`}
    >
      <div className="size-12 rounded-full bg-base-300 grid place-items-center mx-auto lg:mx-0 shrink-0">
        <UsersRound className="size-6" />
      </div>
      <div className="hidden lg:flex items-center w-full text-left min-w-0 gap-1">
        <div className="min-w-0">
          <div className="font-medium truncate">{c.name}</div>
          <div className="text-sm text-zinc-400">{c.participants?.length || 0} members</div>
        </div>
        {c.isMuted && <BellOff className="size-3.5 opacity-50 ml-auto" />}
        <Badge count={c.unread} />
      </div>
    </button>
  );

  const UserRow = ({ u: user, conv }) => (
    <button
      key={user._id}
      onClick={() => setSelectedUser(user)}
      className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors ${
        selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""
      }`}
    >
      <div className="relative mx-auto lg:mx-0 shrink-0">
        <img
          src={user.profilePic || "/avatar.png"}
          alt={user.fullName}
          className="size-12 object-cover rounded-full"
        />
        {onlineUsers.includes(user._id) && (
          <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-zinc-900" />
        )}
      </div>
      <div className="hidden lg:flex items-center w-full text-left min-w-0 gap-1">
        <div className="min-w-0">
          <div className="font-medium truncate">{user.fullName}</div>
          <div className="text-sm text-zinc-400">
            {onlineUsers.includes(user._id) ? "Online" : "Offline"}
          </div>
        </div>
        {conv?.isMuted && <BellOff className="size-3.5 opacity-50 ml-auto" />}
        <Badge count={conv?.unread || 0} />
      </div>
    </button>
  );

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Contacts</span>
          </div>
          <button
            onClick={() => setShowGroupModal(true)}
            className="btn btn-ghost btn-xs btn-circle"
            title="New group"
          >
            <Plus className="size-5" />
          </button>
        </div>
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {activeGroups.length > 0 && (
          <div className="pb-1">
            <p className="px-3 pb-1 text-xs uppercase opacity-50 hidden lg:block">Groups</p>
            {activeGroups.map(GroupRow)}
            <p className="px-3 pt-2 pb-1 text-xs uppercase opacity-50 hidden lg:block">Direct</p>
          </div>
        )}

        {activeUsers.map((x) => (
          <UserRow key={x.u._id} {...x} />
        ))}

        {archivedCount > 0 && (
          <div className="mt-2 border-t border-base-300 pt-2">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm opacity-70 hover:bg-base-300"
            >
              <Archive className="size-4" />
              <span className="hidden lg:inline">Archived ({archivedCount})</span>
            </button>
            {showArchived && (
              <>
                {archivedGroups.map(GroupRow)}
                {archivedUsers.map((x) => (
                  <UserRow key={x.u._id} {...x} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {showGroupModal && <CreateGroupModal onClose={() => setShowGroupModal(false)} />}
    </aside>
  );
};
export default Sidebar;
