import { useEffect, useState } from "react";
import { useChatStore } from "../../store/useChatStore";
import Avatar from "../Avatar";
import { Clock, Trash2, Image as ImageIcon, Paperclip, UsersRound } from "lucide-react";

const fmtWhen = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const ScheduledPanel = () => {
  const { getScheduled, cancelScheduled } = useChatStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [getScheduled]);

  const remove = async (id) => {
    const ok = await cancelScheduled(id);
    if (ok) setItems((list) => list.filter((i) => i._id !== id));
  };

  const targetName = (it) =>
    it.conversationId?.isGroup ? it.conversationId?.name || "Group" : it.receiverId?.fullName || "Unknown";

  if (loading) return <p className="p-4 opacity-60">Loading…</p>;
  if (items.length === 0)
    return (
      <p className="p-8 opacity-60 text-center text-sm">
        Nothing scheduled. Use the clock icon in the message box to schedule one.
      </p>
    );

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it._id} className="flex items-center gap-3 p-3 rounded-xl bg-base-200">
          {it.conversationId?.isGroup ? (
            <Avatar group name={it.conversationId?.name} size="size-10" className="shrink-0" />
          ) : (
            <Avatar user={it.receiverId} size="size-10" className="shrink-0" />
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
            className="btn btn-ghost btn-sm btn-circle text-error shrink-0"
            title="Cancel"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ScheduledPanel;
