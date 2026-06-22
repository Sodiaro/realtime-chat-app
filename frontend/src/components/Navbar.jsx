import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import { usePanelStore } from "../store/usePanelStore";
import Avatar from "./Avatar";
import Logo from "./Logo";
import ConfirmModal from "./ui/ConfirmModal";
import {
  LogOut, Settings, User, Shield, Star, Phone, Clock, UserRound, Users, Sun, Moon,
} from "lucide-react";

// compact icon-only nav button that opens a slide-over panel
const IconBtn = ({ onClick, icon, label, active }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`btn btn-ghost btn-sm btn-circle ${
      active ? "bg-primary/10 text-primary" : "text-base-content/60 hover:text-base-content"
    }`}
  >
    {icon}
  </button>
);

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { conversations } = useChatStore();
  const { resolved, toggle } = useThemeStore();
  const { panel, openPanel } = usePanelStore();
  const { pathname } = useLocation();
  const isDark = resolved === "devdark";
  const [confirmLogout, setConfirmLogout] = useState(false);

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.isArchived ? 0 : c.unread || 0),
    0
  );

  const closeMenu = () => document.activeElement?.blur();
  // logged-in desktop uses the persistent left icon rail instead of the top bar
  const hiddenOnDesktop = Boolean(authUser);

  return (
    <header
      className={`bg-base-100/80 border-b border-base-300/70 fixed w-full top-0 z-40 backdrop-blur-xl ${
        hiddenOnDesktop ? "md:hidden" : ""
      }`}
    >
      <div className="w-full px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        {/* logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
          <div className="relative">
            <Logo className="size-9" />
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 badge badge-primary badge-sm border-2 border-base-100">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <h1 className="text-base font-bold tracking-tight hidden sm:block">DevChat</h1>
        </Link>

        {/* actions */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {authUser && (
            <nav className="flex items-center gap-0.5">
              <IconBtn onClick={() => openPanel("contacts")} icon={<UserRound className="size-[18px]" />} label="Contacts" active={panel === "contacts"} />
              <IconBtn onClick={() => openPanel("calls")} icon={<Phone className="size-[18px]" />} label="Calls" active={panel === "calls"} />
              <IconBtn onClick={() => openPanel("scheduled")} icon={<Clock className="size-[18px]" />} label="Scheduled" active={panel === "scheduled"} />
              <IconBtn onClick={() => openPanel("starred")} icon={<Star className="size-[18px]" />} label="Starred" active={panel === "starred"} />
              <Link
                to="/communities"
                aria-label="Communities"
                title="Communities"
                className={`btn btn-ghost btn-sm btn-circle ${
                  pathname === "/communities" ? "text-primary bg-primary/10" : "text-base-content/60 hover:text-base-content"
                }`}
              >
                <Users className="size-[18px]" />
              </Link>
            </nav>
          )}

          {authUser && (
            <Link
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className={`btn btn-ghost btn-sm btn-circle ${
                pathname === "/settings" ? "text-primary bg-primary/10" : "text-base-content/60 hover:text-base-content"
              }`}
            >
              <Settings className="size-[18px]" />
            </Link>
          )}

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title={isDark ? "Switch to light" : "Switch to dark"}
            className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
          >
            {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>

          {authUser && (
            <div className="dropdown dropdown-end">
              <button
                tabIndex={0}
                aria-label="Account menu"
                className="ml-0.5 sm:ml-1 rounded-full ring-offset-1 ring-offset-base-100 hover:ring-2 ring-primary/40 transition focus:outline-none focus:ring-2"
              >
                <Avatar user={authUser} size="size-8" />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box shadow-pop border border-base-300/60 w-60 mt-2 p-2 z-50"
              >
                <li className="px-2 py-1.5 mb-1">
                  <div className="flex items-center gap-3 hover:bg-transparent cursor-default active:!bg-transparent pointer-events-none">
                    <Avatar user={authUser} size="size-10" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{authUser.fullName}</div>
                      <div className="text-xs opacity-60 truncate">{authUser.email}</div>
                    </div>
                  </div>
                </li>
                <li>
                  <Link to="/profile" onClick={closeMenu}>
                    <User className="size-4" /> Profile
                  </Link>
                </li>
                <li>
                  <Link to="/settings" onClick={closeMenu}>
                    <Settings className="size-4" /> Settings
                  </Link>
                </li>
                {authUser.isAdmin && (
                  <li>
                    <Link to="/admin" onClick={closeMenu}>
                      <Shield className="size-4" /> Admin
                    </Link>
                  </li>
                )}
                <div className="h-px bg-base-300/70 my-1.5" />
                <li>
                  <button onClick={() => { closeMenu(); setConfirmLogout(true); }} className="text-error">
                    <LogOut className="size-4" /> Log out
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
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
    </header>
  );
};

export default Navbar;
