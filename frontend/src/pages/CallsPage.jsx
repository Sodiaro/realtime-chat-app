import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "../components/Avatar";
import PageHeader from "../components/ui/PageHeader";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";

const fmtDur = (s) => (s ? `${Math.floor(s / 60)}m ${s % 60}s` : "");
const fmtWhen = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const CallsPage = () => {
  const { authUser } = useAuthStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/calls");
      setCalls(res.data);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser) load();
  }, [authUser, load]);

  if (!authUser) return <Navigate to="/login" />;

  return (
    <div className="max-w-2xl mx-auto pt-24 px-4 pb-10">
      <PageHeader icon={Phone} title="Call history" subtitle="Your recent voice and video calls" />
      {loading ? (
        <p>Loading…</p>
      ) : calls.length === 0 ? (
        <p className="opacity-60">No calls yet.</p>
      ) : (
        <div className="space-y-1">
          {calls.map((c) => {
            const outgoing = String(c.callerId?._id) === authUser._id;
            const other = outgoing ? c.calleeId : c.callerId;
            const Icon =
              c.status === "missed" || c.status === "rejected"
                ? PhoneMissed
                : outgoing
                  ? PhoneOutgoing
                  : PhoneIncoming;
            const color =
              c.status === "missed" || c.status === "rejected" ? "text-error" : "text-success";
            return (
              <div key={c._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200">
                <Avatar user={other} size="size-10" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{other?.fullName || "Unknown"}</div>
                  <div className="text-xs opacity-60 flex items-center gap-1">
                    <Icon className={`size-3.5 ${color}`} />
                    {c.status} · {fmtWhen(c.createdAt)} {c.durationSec ? `· ${fmtDur(c.durationSec)}` : ""}
                  </div>
                </div>
                {c.type === "video" ? (
                  <Video className="size-4 opacity-50" />
                ) : (
                  <Phone className="size-4 opacity-50" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallsPage;
