import { useEffect } from "react";
import { X, Download } from "lucide-react";

// Full-screen image viewer. Click the backdrop or press Esc to close.
const Lightbox = ({ src, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/90 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="btn btn-circle btn-sm btn-ghost text-white"
          title="Open / download"
        >
          <Download className="size-5" />
        </a>
        <button onClick={onClose} className="btn btn-circle btn-sm btn-ghost text-white" title="Close">
          <X className="size-6" />
        </button>
      </div>
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-[95vw] object-contain rounded"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default Lightbox;
