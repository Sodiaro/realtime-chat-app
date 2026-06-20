import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const WIDTHS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

// Accessible, animated modal shell: backdrop blur, Esc to close, click-outside,
// focus trap + focus return, optional title/footer. Body scrolls within a cap.
const Modal = ({ open = true, onClose, title, children, footer, size = "md" }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const prevFocused = document.activeElement;

    // move focus into the dialog
    const focusables = () => [...node.querySelectorAll(FOCUSABLE)];
    (focusables()[0] || node).focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      prevFocused?.focus?.(); // return focus to the trigger
    };
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${WIDTHS[size] ?? WIDTHS.md} max-h-[88vh] flex flex-col rounded-2xl bg-base-100 border border-base-300/60 shadow-pop animate-scale-in overflow-hidden outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-300/70 shrink-0">
            <h3 className="font-semibold">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm btn-circle">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-base-300/70 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
