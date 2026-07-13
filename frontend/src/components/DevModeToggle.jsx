import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useDevModeStore } from "../store/useDevModeStore";

// Flag-gated Dev Mode switch. Renders NOTHING when the dev_mode feature flag is off,
// so Chat Mode users never see it.
//
//   variant="global"     → the viewer's personal Dev Mode (authUser.devMode.enabled)
//   variant="workspace"  → a group's workspace override (admins can change; others see
//                          the state, disabled). Pass the live `conversation`.
const DevModeToggle = ({ variant = "global", conversation = null, title, desc }) => {
  const available = useDevModeStore((s) => Boolean(s.flags?.dev_mode));
  const { authUser, setDevMode } = useAuthStore();
  const setWorkspaceDevMode = useChatStore((s) => s.setWorkspaceDevMode);

  if (!available) return null; // hidden entirely when the feature flag is disabled

  let checked;
  let disabled = false;
  let lockNote = null;
  let onChange;

  if (variant === "workspace") {
    if (!conversation?.isGroup) return null; // workspaces are groups (DMs aren't)
    const myId = authUser?._id;
    const isAdmin = (conversation.admins || []).some((a) => (a?._id || a) === myId);
    checked = Boolean(conversation.devMode?.enabled);
    disabled = !isAdmin;
    if (!isAdmin) lockNote = "Only admins can change this";
    onChange = (val) => setWorkspaceDevMode(conversation._id, val);
  } else {
    checked = Boolean(authUser?.devMode?.enabled);
    onChange = (val) => setDevMode({ enabled: val });
  }

  const label = title || (variant === "workspace" ? "Dev Mode for this workspace" : "Dev Mode");

  return (
    <label
      className={`flex items-center gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      title={lockNote || undefined}
    >
      <input
        type="checkbox"
        className="toggle toggle-primary toggle-sm"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      {(title || desc || lockNote) && (
        <div>
          {title && <div className="text-sm font-medium">{title}</div>}
          {desc && <div className="text-xs opacity-60">{desc}</div>}
          {lockNote && <div className="text-xs opacity-50">{lockNote}</div>}
        </div>
      )}
    </label>
  );
};

export default DevModeToggle;
