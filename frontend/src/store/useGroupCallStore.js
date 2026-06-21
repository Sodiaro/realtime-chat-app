import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { startRingtone, stopRingtone } from "../lib/ringtone";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// non-serialisable / imperative state lives outside zustand
let localStream = null;
const pcs = new Map(); // userId -> RTCPeerConnection
const remoteStreams = new Map(); // userId -> MediaStream
const pendingIce = new Map(); // userId -> ICE candidates buffered until remoteDescription is set
let curRoom = null;

const sock = () => useAuthStore.getState().socket;
const me = () => useAuthStore.getState().authUser;

// stable id without Date.now()/Math.random restrictions (this is app code, not a workflow)
const newRoomId = () => `gc-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export const useGroupCallStore = create((set, get) => ({
  inCall: false,
  roomId: null,
  isVideo: false,
  title: "",
  incoming: null, // { roomId, from, fromName, fromPic, video, title, groupId }
  participants: [], // remote peers: [{ userId, name, pic }]
  streamTick: 0, // bumped when a remote stream attaches/detaches → re-render tiles
  muted: false,
  cameraOff: false,
  activeGroupCalls: {}, // groupId -> { roomId, count } so members can join an ongoing call

  getRemoteStream: (userId) => remoteStreams.get(userId) || null,
  getLocalStream: () => localStream,

  _ensureLocal: async (video) => {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    }
    // bump streamTick so the overlay re-renders and attaches the local stream
    set((s) => ({ isVideo: video, streamTick: s.streamTick + 1 }));
    return localStream;
  },

  _makePeer: (userId, name, pic) => {
    if (pcs.has(userId)) return pcs.get(userId);
    const pc = new RTCPeerConnection(ICE);
    if (localStream) localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    pc.ontrack = (e) => {
      remoteStreams.set(userId, e.streams[0]);
      set((s) => ({ streamTick: s.streamTick + 1 }));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) sock()?.emit("gcall:ice", { roomId: curRoom, to: userId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) get()._removePeer(userId);
    };
    pcs.set(userId, pc);

    // make sure this peer shows up even before media arrives
    set((s) =>
      s.participants.some((p) => p.userId === userId)
        ? {}
        : { participants: [...s.participants, { userId, name, pic }] }
    );
    return pc;
  },

  _drainIce: async (userId) => {
    const pc = pcs.get(userId);
    const queued = pendingIce.get(userId);
    if (!pc || !queued) return;
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
    pendingIce.delete(userId);
  },

  _removePeer: (userId) => {
    const pc = pcs.get(userId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
      pcs.delete(userId);
    }
    remoteStreams.delete(userId);
    pendingIce.delete(userId);
    set((s) => ({
      participants: s.participants.filter((p) => p.userId !== userId),
      streamTick: s.streamTick + 1,
    }));
  },

  // start a fresh call (ad-hoc multi-person or a group call)
  startGroupCall: async ({ groupId, invitees, video, title }) => {
    if (get().inCall) return;
    const roomId = groupId ? `group:${groupId}` : newRoomId();
    curRoom = roomId;
    const u = me();
    try {
      set({ inCall: true, roomId, isVideo: video, title: title || "Group call", participants: [], muted: false, cameraOff: false });
      await get()._ensureLocal(video);
      sock()?.emit("gcall:join", { roomId, groupId, name: u?.fullName, pic: u?.profilePic });
      sock()?.emit("gcall:invite", {
        roomId,
        groupId,
        to: invitees,
        video,
        title: title || "Group call",
        fromName: u?.fullName,
        fromPic: u?.profilePic,
      });
    } catch {
      toast.error("Couldn't start call — camera/mic blocked?");
      get()._teardown();
    }
  },

  // accept the ringing invite
  acceptIncoming: async () => {
    const inc = get().incoming;
    if (!inc || get().inCall) return;
    stopRingtone();
    curRoom = inc.roomId;
    const u = me();
    try {
      set({ inCall: true, roomId: inc.roomId, isVideo: inc.video, title: inc.title || "Group call", incoming: null, participants: [], muted: false, cameraOff: false });
      await get()._ensureLocal(inc.video);
      sock()?.emit("gcall:join", { roomId: inc.roomId, groupId: inc.groupId, name: u?.fullName, pic: u?.profilePic });
    } catch {
      toast.error("Couldn't join call");
      get()._teardown();
    }
  },

  declineIncoming: () => {
    stopRingtone();
    set({ incoming: null });
  },

  // join an already-running group call (no invite needed — you're a member)
  joinExisting: async ({ roomId, groupId, video, title }) => {
    if (get().inCall) return;
    curRoom = roomId;
    const u = me();
    try {
      set({ inCall: true, roomId, isVideo: video, title: title || "Group call", incoming: null, participants: [], muted: false, cameraOff: false });
      await get()._ensureLocal(video);
      sock()?.emit("gcall:join", { roomId, groupId, name: u?.fullName, pic: u?.profilePic });
    } catch {
      toast.error("Couldn't join call");
      get()._teardown();
    }
  },

  leaveCall: () => {
    if (curRoom) sock()?.emit("gcall:leave", { roomId: curRoom });
    get()._teardown();
  },

  _teardown: () => {
    stopRingtone();
    for (const userId of [...pcs.keys()]) {
      const pc = pcs.get(userId);
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    pcs.clear();
    remoteStreams.clear();
    pendingIce.clear();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    curRoom = null;
    set((s) => ({ inCall: false, roomId: null, isVideo: false, title: "", participants: [], muted: false, cameraOff: false, streamTick: s.streamTick + 1 }));
  },

  toggleMute: () => {
    if (!localStream) return;
    const on = !get().muted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !on));
    set({ muted: on });
  },
  toggleCamera: () => {
    if (!localStream) return;
    const off = !get().cameraOff;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !off));
    set({ cameraOff: off });
  },

  subscribeGroupCall: () => {
    const s = sock();
    if (!s) return;
    const events = [
      "gcall:incoming", "gcall:peers", "gcall:peer-joined",
      "gcall:offer", "gcall:answer", "gcall:ice", "gcall:peer-left", "gcall:state",
    ];
    events.forEach((e) => s.off(e));

    s.on("gcall:incoming", (inc) => {
      if (inc.groupId) {
        set((st) => ({ activeGroupCalls: { ...st.activeGroupCalls, [inc.groupId]: { roomId: inc.roomId, count: 1 } } }));
      }
      // already busy or already ringing → don't override
      if (get().inCall || get().incoming) return;
      startRingtone();
      set({ incoming: inc });
    });

    // I just joined → offer to everyone already here
    s.on("gcall:peers", async ({ roomId, peers }) => {
      for (const p of peers) {
        const pc = get()._makePeer(p.userId, p.name, p.pic);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          s.emit("gcall:offer", { roomId, to: p.userId, offer });
        } catch {
          /* ignore */
        }
      }
    });

    // someone new joined → they'll offer to me; just show them
    s.on("gcall:peer-joined", ({ userId, name, pic }) => {
      set((st) =>
        st.participants.some((p) => p.userId === userId)
          ? {}
          : { participants: [...st.participants, { userId, name, pic }] }
      );
    });

    s.on("gcall:offer", async ({ roomId, from, offer }) => {
      const pc = get()._makePeer(from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await get()._drainIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("gcall:answer", { roomId, to: from, answer });
      } catch {
        /* ignore */
      }
    });

    s.on("gcall:answer", async ({ from, answer }) => {
      const pc = pcs.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await get()._drainIce(from);
      } catch {
        /* ignore */
      }
    });

    s.on("gcall:ice", async ({ from, candidate }) => {
      if (!candidate) return;
      const pc = pcs.get(from);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore */
        }
      } else {
        pendingIce.set(from, [...(pendingIce.get(from) || []), candidate]);
      }
    });

    s.on("gcall:peer-left", ({ userId }) => get()._removePeer(userId));

    s.on("gcall:state", ({ groupId, active, count }) => {
      if (!groupId) return;
      set((st) => {
        const next = { ...st.activeGroupCalls };
        if (active) next[groupId] = { roomId: `group:${groupId}`, count };
        else delete next[groupId];
        return { activeGroupCalls: next };
      });
    });
  },

  unsubscribeGroupCall: () => {
    const s = sock();
    if (!s) return;
    [
      "gcall:incoming", "gcall:peers", "gcall:peer-joined",
      "gcall:offer", "gcall:answer", "gcall:ice", "gcall:peer-left", "gcall:state",
    ].forEach((e) => s.off(e));
  },
}));
