import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users } from "lucide-react";
import { useGroupCallStore } from "../store/useGroupCallStore";
import Avatar from "./Avatar";

// one participant tile — attaches a MediaStream to a <video>, falling back to the
// avatar when there's no video track (audio-only or camera off)
const Tile = ({ stream, name, pic, you }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  const hasVideo = !!stream && stream.getVideoTracks?.().length > 0;

  return (
    <div className="relative rounded-xl overflow-hidden bg-base-300 grid place-items-center aspect-video min-h-[120px]">
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={you} className="w-full h-full object-cover" />
      ) : (
        <>
          {stream && <video ref={ref} autoPlay playsInline muted={you} className="hidden" />}
          <Avatar user={{ profilePic: pic, fullName: name }} size="size-16" />
        </>
      )}
      <span className="absolute bottom-1.5 left-1.5 text-xs bg-black/55 text-white px-2 py-0.5 rounded-full max-w-[90%] truncate">
        {name || "Member"}
        {you ? " (You)" : ""}
      </span>
    </div>
  );
};

const colsClass = (n) => (n <= 1 ? "grid-cols-1" : n <= 4 ? "grid-cols-2" : "grid-cols-3");

const GroupCallOverlay = () => {
  const {
    inCall, incoming, participants, muted, cameraOff, isVideo, title, streamTick,
    getRemoteStream, getLocalStream, acceptIncoming, declineIncoming, leaveCall, toggleMute, toggleCamera,
  } = useGroupCallStore();

  // ringing invite (only when not already in a call)
  if (incoming && !inCall) {
    return (
      <div className="fixed inset-0 z-[62] grid place-items-center bg-black/60">
        <div className="bg-base-100 rounded-2xl p-8 text-center w-80">
          <div className="size-20 mx-auto rounded-full bg-primary/15 text-primary grid place-items-center">
            <Users className="size-9" />
          </div>
          <h3 className="text-lg font-semibold mt-3">{incoming.title || "Group call"}</h3>
          <p className="opacity-60 text-sm">
            {incoming.fromName ? `${incoming.fromName} is inviting you` : "Incoming"} · {incoming.video ? "video" : "voice"}
          </p>
          <div className="flex justify-center gap-6 mt-6">
            <button onClick={declineIncoming} className="btn btn-circle btn-lg btn-error" title="Decline">
              <PhoneOff />
            </button>
            <button onClick={acceptIncoming} className="btn btn-circle btn-lg btn-success" title="Join">
              <Phone />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!inCall) return null;

  // streamTick keeps this re-rendering as remote streams attach/detach
  void streamTick;
  const local = getLocalStream();
  const count = participants.length + 1;

  return (
    <div className="fixed inset-0 z-[62] bg-base-300 flex flex-col">
      <div className="px-5 py-3 flex items-center gap-2 text-base-content/80">
        <Users className="size-5" />
        <span className="font-medium truncate">{title}</span>
        <span className="badge badge-sm">{count}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className={`grid gap-3 ${colsClass(count)}`}>
          <Tile stream={local} name="You" you pic={undefined} />
          {participants.map((p) => (
            <Tile key={p.userId} stream={getRemoteStream(p.userId)} name={p.name} pic={p.pic} />
          ))}
        </div>
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
        <button onClick={leaveCall} className="btn btn-circle btn-lg btn-error" title="Leave">
          <PhoneOff />
        </button>
      </div>
    </div>
  );
};

export default GroupCallOverlay;
