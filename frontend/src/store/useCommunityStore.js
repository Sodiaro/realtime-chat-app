import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useCommunityStore = create((set, get) => ({
  communities: [], // my communities (list w/ counts)
  active: null, // { community, announcement, groups, isAdmin }
  loading: false,

  getCommunities: async () => {
    try {
      const res = await axiosInstance.get("/communities");
      set({ communities: res.data });
    } catch {
      /* non-fatal */
    }
  },

  createCommunity: async (name, description) => {
    try {
      const res = await axiosInstance.post("/communities", { name, description });
      await get().getCommunities();
      toast.success("Community created");
      return res.data.community;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create community");
      return null;
    }
  },

  openCommunity: async (id) => {
    set({ loading: true });
    try {
      const res = await axiosInstance.get(`/communities/${id}`);
      set({ active: res.data, loading: false });
    } catch (e) {
      toast.error(e.response?.data?.message || "Couldn't open community");
      set({ loading: false });
    }
  },

  closeCommunity: () => set({ active: null }),

  createGroup: async (id, name) => {
    try {
      await axiosInstance.post(`/communities/${id}/groups`, { name });
      await get().openCommunity(id);
      await get().getCommunities();
      toast.success("Group created");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create group");
      return false;
    }
  },

  joinCommunity: async (id) => {
    try {
      await axiosInstance.post(`/communities/${id}/join`);
      await get().getCommunities();
      await get().openCommunity(id);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to join");
    }
  },

  leaveCommunity: async (id) => {
    try {
      await axiosInstance.post(`/communities/${id}/leave`);
      set({ active: null });
      await get().getCommunities();
      toast.success("Left community");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to leave");
    }
  },

  joinGroup: async (id, groupId) => {
    try {
      const res = await axiosInstance.post(`/communities/${id}/groups/${groupId}/join`);
      await get().openCommunity(id);
      return res.data;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to join group");
      return null;
    }
  },
}));
