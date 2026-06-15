import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket:null,
 

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  blockUser: async (userId) => {
    try {
      const res = await axiosInstance.post(`/auth/block/${userId}`);
      set({ authUser: { ...get().authUser, blockedUsers: res.data.blockedUsers } });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update block");
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      await axiosInstance.post("/auth/change-password", { currentPassword, newPassword });
      toast.success("Password changed");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
      return false;
    }
  },

  logoutAllDevices: async () => {
    try {
      await axiosInstance.post("/auth/logout-all");
      toast.success("Logged out of all other devices");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed");
    }
  },

  deleteAccount: async () => {
    try {
      await axiosInstance.delete("/auth/me");
      set({ authUser: null });
      get().disconnectSocket();
      toast.success("Account deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete account");
    }
  },

   connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      // send the JWT cookie on the handshake (socket auth needs it; required
      // cross-origin in dev where 5173 → 5001)
      withCredentials: true,
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },

}));