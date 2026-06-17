import { useEffect, useState, useCallback } from "react";
import { X, Trash2, Eye } from "lucide-react";
import { useStatusStore } from "../store/useStatusStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";
import { formatMessageTime } from "../lib/utils";

const StatusViewer = () => {
  const { viewing, closeViewer, viewStatus, deleteStatus } = useStatusStore();
  const { authUser } = useAuthStore();
  const [idx, setIdx] = useState(0);
  const [showViewers, setShowViewers] = useState(false);

  useEffect(() => {
    setIdx(0);
  }, [viewing]);

  // collapse the viewers list whenever the visible status changes
  useEffect(() => {
    setShowViewers(false);
  }, [idx, viewing]);

  const statuses = viewing?.statuses || [];
  const cur = statuses[idx];

  const next = useCallback(() => {
    setIdx((i) => {
      if (i < statuses.length - 1) return i + 1;
      closeViewer();
      return i;
    });
  }, [statuses.length, closeViewer]);

  // record the view once per visible status
  useEffect(() => {
    if (cur) viewStatus(cur._id);
  }, [cur, viewStatus]);

  // auto-advance after 5s — paused while inspecting the viewers list
  useEffect(() => {
    if (!cur || showViewers) return;
    const t = setTimeout(next, 5000);
    return () => clearTimeout(t);
  }, [cur, next, showViewers]);

  if (!viewing || !cur) return null;
  const isMine = viewing.user?._id === authUser._id;
  const viewers = cur.views || [];
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <div className="flex gap-1 p-2">
        {statuses.map((s, i) => (
          <div key={s._id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
            <div className={`h-full bg-white ${i <= idx ? "w-full" : "w-0"}`} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 text-white">
        <Avatar user={viewing.user} size="size-9" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{isMine ? "My status" : viewing.user.fullName}</div>
          <div className="text-xs opacity-70">{formatMessageTime(cur.createdAt)}</div>
        </div>
        <div className="flex-1" />
        {isMine && (
          <button onClick={() => { deleteStatus(cur._id); closeViewer(); }} title="Delete">
            <Trash2 className="size-5" />
          </button>
        )}
        <button onClick={closeViewer} title="Close">
          <X className="size-6" />
        </button>
      </div>

      <div
        className="flex-1 grid place-items-center relative"
        style={cur.type === "text" ? { background: cur.bgColor || "#16a34a" } : {}}
      >
        <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={prev} />
        <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={next} />
        {cur.type === "image" ? (
          <img src={cur.image} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-white text-2xl font-medium p-8 text-center">{cur.text}</p>
        )}
      </div>

      {isMine && (
        <div className="bg-black">
          <button
            onClick={() => setShowViewers((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-white/80 text-sm hover:text-white"
          >
            <Eye className="size-4" />
            {viewers.length} {viewers.length === 1 ? "view" : "views"}
          </button>

          {showViewers && (
            <div className="max-h-56 overflow-y-auto px-4 pb-4 space-y-3">
              {viewers.length === 0 && (
                <p className="text-center text-white/50 text-sm py-2">No views yet</p>
              )}
              {viewers.map((v) => (
                <div key={v.user?._id} className="flex items-center gap-3">
                  <Avatar user={v.user} size="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{v.user?.fullName}</div>
                  </div>
                  <div className="text-xs text-white/50 shrink-0">
                    {formatMessageTime(v.viewedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusViewer;
