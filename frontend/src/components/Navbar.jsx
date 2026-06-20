import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import {
  LogOut, MessageSquare, Settings, User, Shield, Star, Phone, Clock, Search, Sun, Moon,
} from "lucide-react";

const NavLink = ({ to, icon, label }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      title={label}
      className={`btn btn-sm btn-ghost gap-2 ${active ? "bg-base-200 text-base-content" : "text-base-content/70"}`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
};

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { conversations } = useChatStore();
  const { resolved, toggle } = useThemeStore();
  const isDark = resolved === "devdark";

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.isArchived ? 0 : c.unread || 0),
    0
  );

  return (
    <header className="bg-base-100/80 border-b border-base-300/70 fixed w-full top-0 z-40 backdrop-blur-xl">
      <div className="container mx-auto px-3 sm:px-4 h-14">
        <div className="flex items-center justify-between h-full gap-2">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0">
            <div className="size-9 rounded-xl bg-primary/15 flex items-center justify-center relative">
              <MessageSquare className="w-[18px] h-[18px] text-primary" />
              {totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 badge badge-primary badge-sm border-2 border-base-100">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <h1 className="text-base font-bold tracking-tight hidden sm:block">DevChat</h1>
          </Link>

          <div className="flex items-center gap-0.5">
            {authUser && (
              <>
                <NavLink to="/search" icon={<Search className="size-[18px]" />} label="Search" />
                <NavLink to="/scheduled" icon={<Clock className="size-[18px]" />} label="Scheduled" />
                <NavLink to="/calls" icon={<Phone className="size-[18px]" />} label="Calls" />
                <NavLink to="/starred" icon={<Star className="size-[18px]" />} label="Starred" />
                {authUser.isAdmin && (
                  <NavLink to="/admin" icon={<Shield className="size-[18px]" />} label="Admin" />
                )}
              </>
            )}

            <div className="w-px h-5 bg-base-300 mx-1.5 hidden sm:block" />

            <button
              onClick={toggle}
              aria-label="Toggle theme"
              title={isDark ? "Switch to light" : "Switch to dark"}
              className="btn btn-sm btn-ghost btn-circle text-base-content/70"
            >
              {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>

            <NavLink to="/settings" icon={<Settings className="size-[18px]" />} label="Settings" />

            {authUser && (
              <>
                <Link to="/profile" className="btn btn-sm btn-ghost gap-2 text-base-content/70" title="Profile">
                  <User className="size-[18px]" />
                  <span className="hidden lg:inline">Profile</span>
                </Link>
                <button
                  onClick={logout}
                  title="Log out"
                  className="btn btn-sm btn-ghost btn-circle text-base-content/70 hover:text-error"
                >
                  <LogOut className="size-[18px]" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
