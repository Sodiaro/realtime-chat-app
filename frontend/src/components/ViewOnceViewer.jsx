import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, EyeOff, FileText } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

// Fullscreen secure viewer for view-once content. Opening already consumed the
// message server-side; closing / tapping away / leaving the screen dismisses it
// for good. Best-effort capture deterrents are applied (the web platform can't
// truly block screenshots/recording — that needs a native client).
const ViewOnceViewer = () => {
  const { viewOnceViewing, closeViewOnce, selectedUser } = useChatStore();
  const open = Boolean(viewOnceViewing);

  // dismiss on Esc, window blur, or the tab being hidden (capture-attempt heuristics)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeViewOnce();
    const onHide = () => document.hidden && closeViewOnce();
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", closeViewOnce);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", closeViewOnce);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [open, closeViewOnce]);

  // leaving the conversation consumes whatever is open
  useEffect(() => {
    if (open) closeViewOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?._id]);

  if (!open) return null;
  const v = viewOnceViewing;
  const isVideo = v.file?.type?.startsWith("video/");
  const block = (e) => e.preventDefault();

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black/95 flex flex-col select-none"
      onClick={closeViewOnce}
      onContextMenu={block}
      onDragStart={block}
    >
      <div className="flex items-center justify-between p-4 text-white/80 shrink-0">
        <span className="flex items-center gap-2 text-sm">
          <EyeOff className="size-4" /> View once — disappears when you close
        </span>
        <button onClick={closeViewOnce} aria-label="Close" className="p-1 hover:text-white">
          <X className="size-6" />
        </button>
      </div>

      <div
        className="flex-1 grid place-items-center p-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {v.image ? (
          <img
            src={v.image}
            alt=""
            draggable={false}
            onContextMenu={block}
            className="max-w-full max-h-full object-contain rounded-lg pointer-events-none"
          />
        ) : isVideo ? (
          <video
            src={v.file.url}
            controls
            autoPlay
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={block}
            className="max-w-full max-h-full rounded-lg"
          />
        ) : v.audio ? (
          <audio src={v.audio} controls autoPlay controlsList="nodownload" className="w-80 max-w-full" />
        ) : v.file ? (
          <div className="text-center text-white">
            <FileText className="size-12 mx-auto mb-3 opacity-80" />
            <p className="font-medium break-all max-w-xs mx-auto">{v.file.name}</p>
            <a
              href={v.file.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn btn-sm btn-primary mt-4"
            >
              Open once
            </a>
          </div>
        ) : v.text ? (
          <p className="text-white text-2xl leading-relaxed max-w-2xl text-center break-words whitespace-pre-wrap">
            {v.text}
          </p>
        ) : (
          <p className="text-white/60">No content</p>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ViewOnceViewer;
