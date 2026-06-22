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

  updateCommunity: async (id, changes) => {
    try {
      await axiosInstance.patch(`/communities/${id}`, changes);
      await get().openCommunity(id);
      await get().getCommunities();
      toast.success("Community updated");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update community");
      return false;
    }
  },

  setRole: async (id, userId, role) => {
    try {
      await axiosInstance.post(`/communities/${id}/role`, { userId, role });
      await get().openCommunity(id);
      toast.success("Role updated");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update role");
    }
  },

  createInvite: async (id) => {
    try {
      const res = await axiosInstance.post(`/communities/${id}/invite`);
      await get().openCommunity(id);
      return res.data.inviteCode;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create invite");
      return null;
    }
  },

  revokeInvite: async (id) => {
    try {
      await axiosInstance.delete(`/communities/${id}/invite`);
      await get().openCommunity(id);
      toast.success("Invite link disabled");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to revoke invite");
      return false;
    }
  },

  previewInvite: async (code) => {
    try {
      const res = await axiosInstance.get(`/communities/invite/${code}`);
      return res.data;
    } catch {
      return null;
    }
  },

  joinByInvite: async (code) => {
    try {
      const res = await axiosInstance.post(`/communities/invite/${code}/join`);
      await get().getCommunities();
      return res.data._id;
    } catch (e) {
      toast.error(e.response?.data?.message || "Invalid or expired invite");
      return null;
    }
  },

  editGroupDescription: async (id, groupId, description) => {
    try {
      await axiosInstance.patch(`/communities/${id}/groups/${groupId}`, { description });
      await get().openCommunity(id);
      toast.success("Group updated");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update group");
      return false;
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
