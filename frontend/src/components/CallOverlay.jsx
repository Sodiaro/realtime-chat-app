import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";

const Stream = ({ stream, muted, className }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
};

const CallOverlay = () => {
  const {
    callState,
    peer,
    isVideo,
    remoteStream,
    localStream,
    muted,
    cameraOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCallStore();
  const { onlineUsers } = useAuthStore();

  if (callState === "idle") return null;

  const peerUser = { profilePic: peer?.pic, fullName: peer?.name };
  // reachable (socket-connected, even if away) → "Ringing"; otherwise "Calling"
  const reachable = peer?.id ? onlineUsers.includes(peer.id) : false;
  const outgoingStatus = reachable ? "Ringing…" : "Calling…";

  if (callState === "incoming") {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60">
        <div className="bg-base-100 rounded-2xl p-8 text-center w-80">
          <Avatar user={peerUser} size="size-20" className="mx-auto" />
          <h3 className="text-lg font-semibold mt-3">{peer?.name}</h3>
          <p className="opacity-60 text-sm">Incoming {isVideo ? "video" : "voice"} call…</p>
          <div className="flex justify-center gap-6 mt-6">
            <button onClick={rejectCall} className="btn btn-circle btn-lg btn-error" title="Decline">
              <PhoneOff />
            </button>
            <button onClick={acceptCall} className="btn btn-circle btn-lg btn-success" title="Accept">
              <Phone />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-base-300 flex flex-col">
      <div className="flex-1 relative grid place-items-center overflow-hidden">
        {isVideo && remoteStream ? (
          <Stream stream={remoteStream} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <Avatar user={peerUser} size="size-28" className="mx-auto" />
            <h3 className="mt-4 text-2xl font-semibold">{peer?.name}</h3>
            <p className="opacity-60 mt-1">{callState === "calling" ? outgoingStatus : "In call"}</p>
            {!isVideo && remoteStream && <Stream stream={remoteStream} className="hidden" />}
          </div>
        )}

        {isVideo && localStream && (
          <Stream
            stream={localStream}
            muted
            className="absolute bottom-4 right-4 w-28 sm:w-40 rounded-xl border-2 border-base-100 object-cover bg-black"
          />
        )}
      </div>

      <div className="p-6 flex justify-center gap-4">
        <button onClick={toggleMute} className="btn btn-circle btn-lg" title={muted ? "Unmute" : "Mute"}>
          {muted ? <MicOff /> : <Mic />}
        </button>
        {isVideo && (
          <button onClick={toggleCamera} className="btn btn-circle btn-lg" title="Toggle camera">
            {cameraOff ? <VideoOff /> : <Video />}
          </button>
        )}
        <button onClick={() => endCall()} className="btn btn-circle btn-lg btn-error" title="Hang up">
          <PhoneOff />
        </button>
      </div>
    </div>
  );
};

export default CallOverlay;
