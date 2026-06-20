import { useCallback, useEffect, useRef, useState } from "react";

// Drag-to-resize width with min/max clamping + localStorage persistence.
// `edge` is the side the handle lives on: "right" grows with rightward drag
// (left sidebar), "left" grows with leftward drag (right panel).
export function useResizable(storageKey, { initial, min, max, edge = "right" }) {
  const [width, setWidth] = useState(() => {
    if (typeof localStorage === "undefined") return initial;
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= min && saved <= max ? saved : initial;
  });

  // latest width without re-binding the drag handlers
  const widthRef = useRef(width);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const startDrag = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const raw = edge === "right" ? startW + dx : startW - dx;
        setWidth(Math.min(max, Math.max(min, raw)));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          /* ignore */
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [edge, min, max, storageKey]
  );

  return [width, startDrag];
}
