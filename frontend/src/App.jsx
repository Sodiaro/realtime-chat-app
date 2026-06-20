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
import CallsPage from "./pages/CallsPage";
import ScheduledPage from "./pages/ScheduledPage";
import SearchPage from "./pages/SearchPage";
import JoinGroupPage from "./pages/JoinGroupPage";

import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useCallStore } from "./store/useCallStore";
import { registerPush } from "./lib/push";
import CallOverlay from "./components/CallOverlay";
import StatusViewer from "./components/StatusViewer";
import CreateStatusModal from "./components/CreateStatusModal";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { subscribeSocket, unsubscribeSocket, conversations } = useChatStore();
  const { subscribeCall, unsubscribeCall } = useCallStore();

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
    subscribeCall();
    return () => {
      unsubscribeSocket();
      unsubscribeCall();
    };
  }, [socket, subscribeSocket, unsubscribeSocket, subscribeCall, unsubscribeCall]);

  // ask for notification permission + register web push once logged in
  useEffect(() => {
    if (!authUser || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      registerPush();
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") registerPush();
      });
    }
  }, [authUser]);

  console.log({ authUser });

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen bg-base-100">
        <Loader className="size-10 animate-spin text-primary" />
      </div>
    );
  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path="/admin" element={authUser ? <AdminPage /> : <Navigate to="/login" />} />
        <Route path="/starred" element={authUser ? <StarredPage /> : <Navigate to="/login" />} />
        <Route path="/calls" element={authUser ? <CallsPage /> : <Navigate to="/login" />} />
        <Route path="/scheduled" element={authUser ? <ScheduledPage /> : <Navigate to="/login" />} />
        <Route path="/search" element={authUser ? <SearchPage /> : <Navigate to="/login" />} />
        <Route path="/join/:code" element={authUser ? <JoinGroupPage /> : <Navigate to="/login" />} />
      </Routes>

      <CallOverlay />
      <StatusViewer />
      <CreateStatusModal />
      <Toaster />
    </div>
  );
};

export default App;
