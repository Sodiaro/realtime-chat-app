import { useEffect } from "react";
import { X } from "lucide-react";

// Right-side slide-over panel: backdrop + click-outside + Esc, full-width on
// mobile, a fixed rail on desktop. Header (icon + title + close) and scroll body.
const SlideOver = ({ open = true, onClose, title, icon, children }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-base-100 border-l border-base-300/60 shadow-pop flex flex-col animate-slide-in-right"
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-base-300/70 shrink-0">
          {icon}
          <h2 className="font-semibold text-lg flex-1 truncate">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm btn-circle">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
};

export default SlideOver;
