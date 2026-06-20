import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import Avatar from "../components/Avatar";
import PageHeader from "../components/ui/PageHeader";
import { Clock, Trash2, Image as ImageIcon, Paperclip, UsersRound } from "lucide-react";

const fmtWhen = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const ScheduledPage = () => {
  const { authUser } = useAuthStore();
  const { getScheduled, cancelScheduled } = useChatStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    (async () => {
      const data = await getScheduled();
      if (active) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authUser, getScheduled]);

  const remove = async (id) => {
    const ok = await cancelScheduled(id);
    if (ok) setItems((list) => list.filter((i) => i._id !== id));
  };

  if (!authUser) return <Navigate to="/login" />;

  const targetName = (it) =>
    it.conversationId?.isGroup
      ? it.conversationId?.name || "Group"
      : it.receiverId?.fullName || "Unknown";

  return (
    <div className="max-w-2xl mx-auto pt-24 px-4 pb-10">
      <PageHeader
        icon={Clock}
        title="Scheduled messages"
        subtitle="Waiting to be delivered — they send automatically at the chosen time."
      />

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="opacity-60">Nothing scheduled. Use the clock icon in the message box to schedule one.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it._id} className="flex items-center gap-3 p-3 rounded-xl bg-base-200">
              {it.conversationId?.isGroup ? (
                <div className="size-10 rounded-full bg-base-300 grid place-items-center shrink-0">
                  <UsersRound className="size-5" />
                </div>
              ) : (
                <Avatar user={it.receiverId} size="size-10" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{targetName(it)}</div>
                <div className="text-sm truncate flex items-center gap-1 opacity-80">
                  {it.image && <ImageIcon className="size-3.5 shrink-0" />}
                  {it.file && <Paperclip className="size-3.5 shrink-0" />}
                  <span className="truncate">
                    {it.text || (it.image ? "Photo" : it.file ? it.file.name : "")}
                  </span>
                </div>
                <div className="text-xs text-primary mt-0.5 flex items-center gap-1">
                  <Clock className="size-3" /> {fmtWhen(it.scheduledAt)}
                </div>
              </div>
              <button
                onClick={() => remove(it._id)}
                className="btn btn-ghost btn-sm btn-circle text-error"
                title="Cancel"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduledPage;
