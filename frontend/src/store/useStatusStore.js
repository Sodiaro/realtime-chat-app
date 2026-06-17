import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useStatusStore = create((set, get) => ({
  groups: [], // [{ user, statuses, hasUnviewed }]
  viewing: null, // the group currently open in the viewer
  showCreate: false,

  getStatuses: async () => {
    try {
      const res = await axiosInstance.get("/status");
      set({ groups: res.data });
    } catch {
      /* non-fatal */
    }
  },

  createStatus: async (payload) => {
    try {
      await axiosInstance.post("/status", payload);
      toast.success("Status posted");
      set({ showCreate: false });
      get().getStatuses();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to post status");
    }
  },

  viewStatus: async (id) => {
    try {
      await axiosInstance.post(`/status/${id}/view`);
    } catch {
      /* non-fatal */
    }
  },

  deleteStatus: async (id) => {
    try {
      await axiosInstance.delete(`/status/${id}`);
      get().getStatuses();
    } catch {
      toast.error("Failed to delete");
    }
  },

  openViewer: (group) => set({ viewing: group }),
  closeViewer: () => {
    set({ viewing: null });
    get().getStatuses(); // refresh viewed state
  },
  setShowCreate: (v) => set({ showCreate: v }),
}));
