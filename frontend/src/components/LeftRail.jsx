import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import { usePanelStore } from "../store/usePanelStore";
import Avatar from "./Avatar";
import ConfirmModal from "./ui/ConfirmModal";
import { MessageSquare, Search, Phone, Clock, Star, Sun, Moon, LogOut, Settings, User } from "lucide-react";

const RailLink = ({ to, icon, label, badge = 0 }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      className={`relative size-11 rounded-xl grid place-items-center transition-colors ${
        active ? "bg-primary text-primary-content" : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
      }`}
    >
      {icon}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 badge badge-primary badge-xs border-2 border-base-200">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
};

// like RailLink but opens a slide-over panel instead of navigating
const RailButton = ({ onClick, icon, label, active }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`size-11 rounded-xl grid place-items-center transition-colors ${
      active ? "bg-primary text-primary-content" : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
    }`}
  >
    {icon}
  </button>
);

// WhatsApp-style vertical icon rail (desktop only — mobile uses the top navbar)
const LeftRail = () => {
  const { authUser, logout } = useAuthStore();
  const { conversations } = useChatStore();
  const { resolved, toggle } = useThemeStore();
  const { panel, openPanel } = usePanelStore();
  const isDark = resolved === "devdark";
  const [confirmLogout, setConfirmLogout] = useState(false);

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.isArchived ? 0 : c.unread || 0),
    0
  );

  return (
    <div className="hidden md:flex w-[68px] shrink-0 flex-col items-center py-4 gap-2 bg-base-200/40 border-r border-base-300/50">
      <div className="dropdown dropdown-right">
        <button
          tabIndex={0}
          aria-label="Account"
          className="rounded-full ring-offset-2 ring-offset-base-200 hover:ring-2 ring-primary/40 transition mb-1 focus:outline-none focus:ring-2"
        >
          <Avatar user={authUser} size="size-11" />
        </button>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box shadow-pop border border-base-300/60 w-52 ml-2 z-50 p-2"
        >
          <li className="px-2 py-1 mb-1">
            <div className="pointer-events-none hover:bg-transparent">
              <div className="text-sm font-semibold truncate">{authUser?.fullName}</div>
            </div>
          </li>
          <li>
            <Link to="/profile">
              <User className="size-4" /> Profile
            </Link>
          </li>
          <li>
            <Link to="/settings">
              <Settings className="size-4" /> Settings
            </Link>
          </li>
        </ul>
      </div>

      <div className="h-px w-8 bg-base-300 my-1" />

      <RailLink to="/" icon={<MessageSquare className="size-5" />} label="Chats" badge={totalUnread} />
      <RailLink to="/search" icon={<Search className="size-5" />} label="Search" />
      <RailButton onClick={() => openPanel("calls")} icon={<Phone className="size-5" />} label="Calls" active={panel === "calls"} />
      <RailButton onClick={() => openPanel("scheduled")} icon={<Clock className="size-5" />} label="Scheduled" active={panel === "scheduled"} />
      <RailButton onClick={() => openPanel("starred")} icon={<Star className="size-5" />} label="Starred" active={panel === "starred"} />

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={toggle}
          title="Toggle theme"
          aria-label="Toggle theme"
          className="size-11 rounded-xl grid place-items-center text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors"
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <button
          onClick={() => setConfirmLogout(true)}
          title="Log out"
          aria-label="Log out"
          className="size-11 rounded-xl grid place-items-center text-base-content/60 hover:bg-base-200 hover:text-error transition-colors"
        >
          <LogOut className="size-5" />
        </button>
      </div>

      {confirmLogout && (
        <ConfirmModal
          title="Log out"
          message="Are you sure you want to log out?"
          confirmLabel="Log out"
          danger
          onConfirm={logout}
          onClose={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
};

export default LeftRail;
