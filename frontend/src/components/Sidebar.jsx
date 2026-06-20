import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useDraftStore } from "../store/useDraftStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import CreateGroupModal from "./CreateGroupModal";
import NewChatModal from "./NewChatModal";
import StatusBar from "./StatusBar";
import Avatar from "./Avatar";
import { Plus, BellOff, Pin, Archive, Search, X, UserPlus, UsersRound, ArrowLeft, ChevronRight, Bookmark } from "lucide-react";

// short preview of a conversation's last message for the list subtitle
const lastMessagePreview = (conv) => {
  const m = conv?.lastMessage;
  if (!m) return "";
  if (m.deletedAt) return "This message was deleted";
  return (
    m.text ||
    (m.image
      ? "📷 Photo"
      : m.audio
        ? "🎤 Voice note"
        : m.file
          ? "📎 File"
          : m.poll
            ? "📊 Poll"
            : m.location
              ? "📍 Location"
              : m.contact
                ? "👤 Contact"
                : m.call
                  ? "📞 Call"
                  : "")
  );
};

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

  const { drafts } = useDraftStore();
  const { authUser } = useAuthStore();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [tab, setTab] = useState("all"); // all | chats | groups
  const [query, setQuery] = useState("");

  useEffect(() => {
    getUsers();
    getConversations();
  }, [getUsers, getConversations]);

  const filteredUsers = users;

  const convForUser = (userId) =>
    conversations.find((c) => !c.isGroup && c.participants?.some((p) => (p._id || p) === userId));
  const lastAt = (conv) => (conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0);
  const pin = (conv) => (conv?.isPinned ? 1 : 0);

  // groups + DMs: pinned first, then newest activity
  const groups = conversations
    .filter((c) => c.isGroup)
    .sort((a, b) => pin(b) - pin(a) || lastAt(b) - lastAt(a));
  const usersWithConv = filteredUsers
    .map((u) => ({ u, conv: convForUser(u._id) }))
    .sort((a, b) => pin(b.conv) - pin(a.conv) || lastAt(b.conv) - lastAt(a.conv));

  const activeGroups = groups.filter((g) => !g.isArchived);
  const archivedGroups = groups.filter((g) => g.isArchived);
  const activeUsers = usersWithConv.filter((x) => !x.conv?.isArchived);
  const archivedUsers = usersWithConv.filter((x) => x.conv?.isArchived);
  const archivedCount = archivedGroups.length + archivedUsers.length;

  // the self-chat ("Notes") conversation — both participants are me
  const selfConv = conversations.find(
    (c) => !c.isGroup && c.participants?.length > 0 && c.participants.every((p) => String(p._id || p) === authUser?._id)
  );

  // one unified, recency-sorted list (pinned first), filtered by the active tab
  const allItems = [
    ...activeUsers.map((x) => ({ key: `u-${x.u._id}`, kind: "dm", x, time: lastAt(x.conv), pinned: x.conv?.isPinned ? 1 : 0 })),
    ...activeGroups.map((c) => ({ key: `g-${c._id}`, kind: "group", c, time: lastAt(c), pinned: c.isPinned ? 1 : 0 })),
  ].sort((a, b) => b.pinned - a.pinned || b.time - a.time);
  const tabItems =
    tab === "chats"
      ? allItems.filter((i) => i.kind === "dm")
      : tab === "groups"
        ? allItems.filter((i) => i.kind === "group")
        : allItems;
  // the sidebar search filters the existing conversation list by name
  const q = query.trim().toLowerCase();
  const visibleItems = q
    ? tabItems.filter((i) =>
        (i.kind === "group" ? i.c.name : i.x.u.fullName)?.toLowerCase().includes(q)
      )
    : tabItems;
  const TABS = [
    { key: "all", label: "All" },
    { key: "chats", label: "Chats" },
    { key: "groups", label: "Groups" },
  ];

  const Badge = ({ count }) =>
    count > 0 ? (
      <span className="ml-auto badge badge-primary badge-sm">{count > 99 ? "99+" : count}</span>
    ) : null;

  const GroupRow = (c) => (
    <button
      key={c._id}
      onClick={() => setSelectedUser({ ...c, fullName: c.name })}
      className={`w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-base-200 transition-colors ${
        selectedUser?._id === c._id ? "bg-primary/10" : ""
      }`}
    >
      <Avatar group src={c.avatar} name={c.name} size="size-14" className="shrink-0" />
      <div className="flex items-center w-full text-left min-w-0 gap-1">
        <div className="min-w-0">
          <div className="font-medium truncate">{c.name}</div>
          <div className="text-sm truncate text-base-content/55">
            {drafts[c._id] && selectedUser?._id !== c._id ? (
              <span className="text-error">Draft: {drafts[c._id]}</span>
            ) : (
              lastMessagePreview(c) || `${c.participants?.length || 0} members`
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {c.isPinned && <Pin className="size-3.5 opacity-50 -rotate-45" />}
          {c.isMuted && <BellOff className="size-3.5 opacity-50" />}
          <Badge count={c.unread} />
        </div>
      </div>
    </button>
  );

  const UserRow = ({ u: user, conv }) => (
    <button
      key={user._id}
      onClick={() => setSelectedUser(user)}
      className={`w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-base-200 transition-colors ${
        selectedUser?._id === user._id ? "bg-primary/10" : ""
      }`}
    >
      <Avatar user={user} size="size-14" className="shrink-0" />
      <div className="flex items-center w-full text-left min-w-0 gap-1">
        <div className="min-w-0">
          <div className="font-medium truncate">{user.fullName}</div>
          <div className="text-sm truncate text-base-content/55">
            {drafts[user._id] && selectedUser?._id !== user._id ? (
              <span className="text-error">Draft: {drafts[user._id]}</span>
            ) : (
              lastMessagePreview(conv)
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {conv?.isPinned && <Pin className="size-3.5 opacity-50 -rotate-45" />}
          {conv?.isMuted && <BellOff className="size-3.5 opacity-50" />}
          <Badge count={conv?.unread || 0} />
        </div>
      </div>
    </button>
  );

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full flex flex-col bg-base-100">
      {/* search the existing conversations + a clear "new" action */}
      <div className="p-3 sm:p-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            className="w-full bg-base-200 rounded-full pl-10 pr-9 py-2.5 text-[15px] outline-none ring-1 ring-transparent focus:ring-primary/30 transition"
            placeholder="Search conversations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="size-4 opacity-50" />
            </button>
          )}
        </div>
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            className="btn btn-ghost btn-circle text-base-content/70 shrink-0"
            title="New"
            aria-label="New conversation"
          >
            <Plus className="size-5" />
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-2xl shadow-pop border border-base-300/60 w-48 mt-2 p-1.5 z-50 [&_li>button]:gap-3 [&_li>button]:rounded-lg [&_li>button]:py-2.5"
          >
            <li>
              <button onClick={() => setShowNewChat(true)}>
                <UserPlus className="size-4" /> New chat
              </button>
            </li>
            <li>
              <button onClick={() => setShowGroupModal(true)}>
                <UsersRound className="size-4" /> New group
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* filter tabs */}
      <div className="px-3 sm:px-4 pb-2 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content/70 hover:bg-base-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <StatusBar />

      {/* one unified conversation list */}
      <div className="overflow-y-auto flex-1 px-2 sm:px-2.5 pb-4">
        {showArchived ? (
          <>
            <button
              onClick={() => setShowArchived(false)}
              className="w-full px-3 py-2.5 mb-1 flex items-center gap-2.5 text-sm rounded-xl hover:bg-base-200/60 text-base-content/70"
            >
              <ArrowLeft className="size-4" />
              <span className="font-medium">Archived</span>
              <span className="ml-auto text-xs opacity-60">{archivedCount}</span>
            </button>
            {archivedCount === 0 ? (
              <p className="px-4 py-8 text-sm opacity-60 text-center">No archived chats</p>
            ) : (
              <>
                {archivedGroups.map(GroupRow)}
                {archivedUsers.map((x) => UserRow(x))}
              </>
            )}
          </>
        ) : (
          <>
            {/* personal notes / self-chat — always available at the top */}
            {tab !== "groups" && !q && (
              <button
                onClick={() => setSelectedUser({ ...authUser, isSelf: true })}
                className={`w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-base-200 transition-colors ${
                  selectedUser?.isSelf ? "bg-primary/10" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar user={authUser} size="size-14" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-primary text-primary-content grid place-items-center ring-2 ring-base-100">
                    <Bookmark className="size-3" />
                  </span>
                </div>
                <div className="flex items-center w-full text-left min-w-0 gap-1">
                  <div className="min-w-0">
                    <div className="font-medium truncate">Notes</div>
                    <div className="text-sm truncate text-base-content/55">
                      {lastMessagePreview(selfConv) || "Message yourself"}
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* archived appears as a normal category at the top of the list */}
            {archivedCount > 0 && tab === "all" && !q && (
              <button
                onClick={() => setShowArchived(true)}
                className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-base-200 transition-colors"
              >
                <div className="size-14 rounded-full bg-base-200 grid place-items-center shrink-0 text-base-content/60">
                  <Archive className="size-5" />
                </div>
                <div className="flex items-center w-full text-left min-w-0 gap-1">
                  <div className="min-w-0">
                    <div className="font-medium">Archived</div>
                    <div className="text-sm truncate text-base-content/55">
                      {archivedCount} conversation{archivedCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  <ChevronRight className="ml-auto size-4 opacity-40 shrink-0" />
                </div>
              </button>
            )}

            {visibleItems.length === 0 ? (
              <p className="px-4 py-8 text-sm opacity-60 text-center">
                {query.trim()
                  ? "No conversations match your search"
                  : tab === "groups"
                    ? "No groups yet"
                    : tab === "chats"
                      ? "No chats yet"
                      : "No conversations yet"}
              </p>
            ) : (
              visibleItems.map((item) => (item.kind === "group" ? GroupRow(item.c) : UserRow(item.x)))
            )}
          </>
        )}
      </div>

      {showGroupModal && <CreateGroupModal onClose={() => setShowGroupModal(false)} />}
      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </aside>
  );
};
export default Sidebar;
