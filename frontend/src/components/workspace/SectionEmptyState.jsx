import { ArrowLeft, Clock } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";

// Scaffold for the placeholder workspace modules (Repositories / Documentation / Issues /
// Activity) until their real content lands in later phases. Provides a header (section +
// workspace + mobile back), a "coming soon" notice, and an optional non-interactive
// `preview` (mock content) so each section conveys its future feature. A later phase swaps
// the preview for the live UI without touching the nav or layout.
const SectionEmptyState = ({ conversation, icon: Icon, title, description, phase, cta, children }) => {
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* section header (mobile back; workspace name for context) */}
      <div className="flex items-center gap-2 px-3.5 h-[63px] border-b border-base-300 shrink-0">
        <button
          onClick={() => setSelectedUser(null)}
          aria-label="Back to chats"
          className="btn btn-ghost btn-sm btn-circle md:hidden -ml-1 shrink-0"
        >
          <ArrowLeft className="size-5" />
        </button>
        {Icon && <Icon className="size-5 text-base-content/60 shrink-0" />}
        <h3 className="font-semibold truncate">{title}</h3>
        <span className="text-base-content/40 hidden sm:inline">·</span>
        <span className="text-sm text-base-content/50 truncate hidden sm:inline">{conversation?.fullName}</span>
        <span className="ml-auto badge badge-sm badge-ghost gap-1 shrink-0" title={`Coming in Phase ${phase}`}>
          <Clock className="size-3" /> Phase {phase}
        </span>
      </div>

      {/* body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* coming-soon notice */}
        <div className="m-3 sm:m-4 rounded-xl border border-base-300 bg-base-200/40 p-4 flex items-start gap-3">
          <div className="size-9 rounded-lg grid place-items-center bg-base-100 text-base-content/50 shrink-0">
            {Icon && <Icon className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-base-content/70">{description}</p>
            <p className="text-xs text-base-content/40 mt-1">
              Preview only — interactive {title.toLowerCase()} arrive in Phase {phase}.
            </p>
          </div>
          {cta && (
            <button className="btn btn-sm btn-primary shrink-0" disabled>
              {cta}
            </button>
          )}
        </div>

        {/* non-interactive mock preview (decorative — hidden from assistive tech) */}
        {children && (
          <div className="px-3 sm:px-4 pb-6 opacity-60 pointer-events-none select-none" aria-hidden="true">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default SectionEmptyState;
