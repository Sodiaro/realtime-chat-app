import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { axiosInstance } from "../lib/axios";
import { startRingtone, stopRingtone } from "../lib/ringtone";
import { ICE_SERVERS } from "../lib/iceConfig";

const ICE = { iceServers: ICE_SERVERS };

// kept outside zustand state (non-serialisable / imperative)
let pc = null;
let localStream = null;
let pendingCandidates = [];
let pendingOffer = null;
let isCaller = false;
let connectedAt = null;
let wasRejected = false;

const sock = () => useAuthStore.getState().socket;

export const useCallStore = create((set, get) => ({
  callState: "idle", // idle | calling | incoming | connected
  peer: null, // { id, name, pic }
  isVideo: false,
  muted: false,
  cameraOff: false,
  remoteStream: null,
  localStream: null,

  _setupPeer: async (peerId, video) => {
    pc = new RTCPeerConnection(ICE);
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    const remote = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remote.addTrack(t));
      set({ remoteStream: remote });
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) sock()?.emit("call:ice", { to: peerId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc?.connectionState)) get().endCall(true);
    };
    set({ localStream });
  },

  startCall: async (user, video) => {
    if (get().callState !== "idle") return;
    const me = useAuthStore.getState().authUser;
    isCaller = true;
    connectedAt = null;
    wasRejected = false;
    startRingtone(); // ringback while waiting
    try {
      set({
        callState: "calling",
        peer: { id: user._id, name: user.fullName, pic: user.profilePic },
        isVideo: video,
        muted: false,
        cameraOff: false,
      });
      await get()._setupPeer(user._id, video);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sock()?.emit("call:offer", {
        to: user._id,
        offer,
        video,
        fromName: me?.fullName,
        fromPic: me?.profilePic,
      });
    } catch {
      toast.error("Couldn't start call — camera/mic blocked?");
      get()._cleanup();
    }
  },

  acceptCall: async () => {
    const { peer, isVideo } = get();
    if (!peer || !pendingOffer) return;
    isCaller = false;
    stopRingtone();
    try {
      await get()._setupPeer(peer.id, isVideo);
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
      for (const c of pendingCandidates) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* ignore */
        }
      }
      pendingCandidates = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock()?.emit("call:answer", { to: peer.id, answer });
      pendingOffer = null;
      connectedAt = Date.now();
      set({ callState: "connected" });
    } catch {
      toast.error("Couldn't answer call");
      get().endCall();
    }
  },

  rejectCall: () => {
    const { peer } = get();
    if (peer) sock()?.emit("call:reject", { to: peer.id });
    get()._cleanup();
  },

  endCall: (silent = false) => {
    const { peer } = get();
    if (peer && !silent) sock()?.emit("call:end", { to: peer.id });
    get()._cleanup();
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

  _cleanup: () => {
    stopRingtone();
    // the caller logs the call to history (covers both parties)
    const { peer, isVideo } = get();
    if (isCaller && peer) {
      axiosInstance
        .post("/calls", {
          calleeId: peer.id,
          type: isVideo ? "video" : "audio",
          status: wasRejected ? "rejected" : connectedAt ? "answered" : "missed",
          durationSec: connectedAt ? Math.round((Date.now() - connectedAt) / 1000) : 0,
        })
        .catch(() => {});
    }
    isCaller = false;
    connectedAt = null;
    wasRejected = false;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      pc = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    pendingCandidates = [];
    pendingOffer = null;
    set({
      callState: "idle",
      peer: null,
      isVideo: false,
      muted: false,
      cameraOff: false,
      remoteStream: null,
      localStream: null,
    });
  },

  subscribeCall: () => {
    const s = sock();
    if (!s) return;
    ["call:incoming", "call:answered", "call:ice", "call:end", "call:reject"].forEach((e) => s.off(e));

    s.on("call:incoming", ({ from, fromName, fromPic, offer, video }) => {
      if (get().callState !== "idle") {
        s.emit("call:reject", { to: from }); // busy
        return;
      }
      pendingOffer = offer;
      startRingtone(); // ring on incoming
      set({ callState: "incoming", peer: { id: from, name: fromName, pic: fromPic }, isVideo: video });
    });

    s.on("call:answered", async ({ answer }) => {
      if (!pc) return;
      stopRingtone();
      connectedAt = Date.now();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of pendingCandidates) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            /* ignore */
          }
        }
        pendingCandidates = [];
        set({ callState: "connected" });
      } catch {
        /* ignore */
      }
    });

    s.on("call:ice", async ({ candidate }) => {
      if (!candidate) return;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore */
        }
      } else {
        pendingCandidates.push(candidate);
      }
    });

    s.on("call:end", () => {
      if (get().callState !== "idle") toast("Call ended");
      get()._cleanup();
    });
    s.on("call:reject", () => {
      wasRejected = true;
      toast("Call declined");
      get()._cleanup();
    });
  },

  unsubscribeCall: () => {
    const s = sock();
    if (!s) return;
    ["call:incoming", "call:answered", "call:ice", "call:end", "call:reject"].forEach((e) => s.off(e));
  },
}));
