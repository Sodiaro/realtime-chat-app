import { useEffect, useState } from "react";
import { axiosInstance } from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";
import { usePanelStore } from "../../store/usePanelStore";
import Avatar from "../Avatar";
import NewGroupCallModal from "../NewGroupCallModal";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Users } from "lucide-react";

const fmtDur = (s) => (s ? `${Math.floor(s / 60)}m ${s % 60}s` : "");
const fmtWhen = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const CallsPanel = () => {
  const { authUser } = useAuthStore();
  const { setSelectedUser } = useChatStore();
  const { closePanel } = usePanelStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCall, setShowNewCall] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/calls");
        if (active) setCalls(res.data);
      } catch {
        /* non-fatal */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openChat = (user) => {
    if (!user?._id) return;
    setSelectedUser(user);
    closePanel();
  };

  const newCallButton = (
    <button onClick={() => setShowNewCall(true)} className="btn btn-primary btn-sm w-full gap-2 mb-3">
      <Users className="size-4" /> New group call
    </button>
  );

  if (loading)
    return (
      <>
        {newCallButton}
        <p className="p-4 opacity-60">Loading…</p>
        {showNewCall && <NewGroupCallModal onClose={() => setShowNewCall(false)} />}
      </>
    );

  return (
    <div className="space-y-1">
      {newCallButton}
      {calls.length === 0 && <p className="p-8 opacity-60 text-center text-sm">No calls yet.</p>}
      {calls.map((c) => {
        const outgoing = String(c.callerId?._id) === authUser._id;
        const other = outgoing ? c.calleeId : c.callerId;
        const failed = c.status === "missed" || c.status === "rejected";
        const Icon = failed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
        return (
          <button
            key={c._id}
            onClick={() => openChat(other)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-base-200 text-left"
          >
            <Avatar user={other} size="size-11" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{other?.fullName || "Unknown"}</div>
              <div className="text-xs opacity-60 flex items-center gap-1">
                <Icon className={`size-3.5 ${failed ? "text-error" : "text-success"}`} />
                <span className="capitalize">{c.status}</span> · {fmtWhen(c.createdAt)}
                {c.durationSec ? ` · ${fmtDur(c.durationSec)}` : ""}
              </div>
            </div>
            {c.type === "video" ? (
              <Video className="size-4 opacity-50" />
            ) : (
              <Phone className="size-4 opacity-50" />
            )}
          </button>
        );
      })}
      {showNewCall && <NewGroupCallModal onClose={() => setShowNewCall(false)} />}
    </div>
  );
};

export default CallsPanel;
