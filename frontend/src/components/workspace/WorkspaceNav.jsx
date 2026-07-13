import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "./sectionRegistry.js";

// Secondary navigation for a Dev Workspace: a horizontal tab strip (GitHub/Dev.to feel).
// Desktop: all tabs fit. Mobile: the strip scrolls horizontally (scrollbar hidden) and the
// active tab is kept in view.
//
// Accessibility: WAI-ARIA tabs pattern with roving tabindex + Arrow/Home/End keyboard nav
// and MANUAL activation (Arrow moves focus only; Enter/Space/click activate). Manual
// activation matters here — automatic activation would mount each section, including the
// heavy chat, on every arrow press.
const WorkspaceNav = ({ active, onSelect }) => {
  const listRef = useRef(null);
  const btnRefs = useRef([]);
  const activeIndex = Math.max(0, SECTIONS.findIndex((s) => s.id === active));
  const [focusIndex, setFocusIndex] = useState(activeIndex);

  // Roving focus follows the active tab whenever selection changes (click, or switching to
  // another workspace) — but stays put while the user arrows between tabs. Derived during
  // render (React's "store info from previous render" pattern), not via an effect.
  const [lastActive, setLastActive] = useState(activeIndex);
  if (lastActive !== activeIndex) {
    setLastActive(activeIndex);
    setFocusIndex(activeIndex);
  }

  // keep the selected tab visible on a narrow strip (adjusts only this element's scrollLeft)
  useEffect(() => {
    const list = listRef.current;
    const el = btnRefs.current[activeIndex];
    if (!list || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = left - 12;
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth + 12;
  }, [activeIndex]);

  const focusTab = (i) => {
    const n = SECTIONS.length;
    const idx = (i + n) % n; // wrap around
    setFocusIndex(idx);
    btnRefs.current[idx]?.focus();
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusTab(focusIndex + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusTab(focusIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(0);
        break;
      case "End":
        e.preventDefault();
        focusTab(SECTIONS.length - 1);
        break;
      default:
        break; // Enter/Space activate the focused tab via its native button click
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Workspace sections"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="flex items-center gap-1 px-2 sm:px-3 h-11 shrink-0 border-b border-base-300 bg-base-100 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SECTIONS.map((s, i) => {
        const Icon = s.icon;
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            id={`ws-tab-${s.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls="workspace-section-panel"
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 transition-colors motion-reduce:transition-none ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
};

export default WorkspaceNav;
