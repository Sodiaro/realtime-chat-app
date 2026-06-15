import React from "react";
import Navbar from "./components/Navbar";
import { Routes, Route, Navigate } from "react-router-dom"

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import StarredPage from "./pages/StarredPage";

import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useThemeStore} from "./store/useThemeStore";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { subscribeSocket, unsubscribeSocket, conversations } = useChatStore();
  const { theme } = useThemeStore();

  // total unread across non-archived conversations → browser tab title
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.isArchived ? 0 : c.unread || 0),
    0
  );
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) DevChat` : "DevChat";
  }, [totalUnread]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // global socket listeners (notifications, unread, delivery) — once per session
  useEffect(() => {
    if (!socket) return;
    subscribeSocket();
    return () => unsubscribeSocket();
  }, [socket, subscribeSocket, unsubscribeSocket]);

  // ask for notification permission once logged in
  useEffect(() => {
    if (authUser && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [authUser]);

  console.log({ authUser });

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );
  return (
    <div data-theme= {theme} >
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path="/admin" element={authUser ? <AdminPage /> : <Navigate to="/login" />} />
        <Route path="/starred" element={authUser ? <StarredPage /> : <Navigate to="/login" />} />
      </Routes>

      <Toaster />
    </div>
  );
};

export default App;
