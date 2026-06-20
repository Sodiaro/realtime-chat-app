import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { LogOut, MessageSquare, Settings, User, Shield, Star, Phone, Clock, Search } from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { conversations } = useChatStore();
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.isArchived ? 0 : c.unread || 0),
    0
  );

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 
    backdrop-blur-lg bg-base-100/80"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center relative">
                <MessageSquare className="w-5 h-5 text-primary" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 badge badge-primary badge-sm">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold">DevChat</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={"/settings"}
              className={`
              btn btn-sm gap-2 transition-colors
              
              `}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {authUser && (
              <Link to={"/calls"} className="btn btn-sm gap-2">
                <Phone className="size-5" />
                <span className="hidden sm:inline">Calls</span>
              </Link>
            )}

            {authUser && (
              <Link to={"/search"} className="btn btn-sm gap-2">
                <Search className="size-5" />
                <span className="hidden sm:inline">Search</span>
              </Link>
            )}

            {authUser && (
              <Link to={"/scheduled"} className="btn btn-sm gap-2">
                <Clock className="size-5" />
                <span className="hidden sm:inline">Scheduled</span>
              </Link>
            )}

            {authUser && (
              <Link to={"/starred"} className="btn btn-sm gap-2">
                <Star className="size-5" />
                <span className="hidden sm:inline">Starred</span>
              </Link>
            )}

            {authUser?.isAdmin && (
              <Link to={"/admin"} className="btn btn-sm gap-2">
                <Shield className="size-5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {authUser && (
              <>
                <Link to={"/profile"} className={`btn btn-sm gap-2`}>
                  <User className="size-5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>

                <button className="flex gap-2 items-center" onClick={logout}>
                  <LogOut className="size-5" />
                  <span className="hidden sm:inline">Logout</span>
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