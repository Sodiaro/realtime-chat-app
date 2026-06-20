import { useEffect, useState } from "react";
import { useThemeStore } from "../store/useThemeStore";
import { useChatBgStore, CHAT_BACKGROUNDS } from "../store/useChatBgStore";
import { useAuthStore } from "../store/useAuthStore";
import { Monitor, Sun, Moon } from "lucide-react";

// turn a raw user-agent string into a friendly "Browser · OS" label
const deviceLabel = (ua = "") => {
  const browser = /edg/i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Browser";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ios/i.test(ua)
        ? "iOS"
        : /mac/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} · ${os}`;
};

const SettingsPage = () => {
  const { mode, setMode } = useThemeStore();
  const { bg, setBg } = useChatBgStore();
  const { authUser, changePassword, logoutAllDevices, deleteAccount, updatePrivacy, getSessions, revokeSession } =
    useAuthStore();

  const THEME_OPTIONS = [
    { key: "system", label: "System", icon: Monitor },
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    (async () => {
      const data = await getSessions();
      if (active) setSessions(data);
    })();
    return () => {
      active = false;
    };
  }, [authUser, getSessions]);

  const onRevoke = async (id) => {
    const ok = await revokeSession(id);
    if (ok) setSessions((s) => s.filter((x) => x._id !== id));
  };

  const onChangePassword = async () => {
    if (!curPw || !newPw) return;
    const ok = await changePassword(curPw, newPw);
    if (ok) {
      setCurPw("");
      setNewPw("");
    }
  };

  const onDelete = async () => {
    if (window.confirm("Delete your account permanently? This cannot be undone.")) {
      await deleteAccount();
    }
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-20 pb-10 max-w-5xl">
      <div className="space-y-6">
        {authUser && (
          <div className="rounded-xl border border-base-300 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Account security</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="password"
                className="input input-bordered"
                placeholder="Current password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
              />
              <input
                type="password"
                className="input input-bordered"
                placeholder="New password (min 6)"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
            </div>
            <button
              onClick={onChangePassword}
              disabled={!curPw || !newPw}
              className="btn btn-primary btn-sm"
            >
              Change password
            </button>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-base-300">
              <button onClick={logoutAllDevices} className="btn btn-sm btn-outline">
                Log out all other devices
              </button>
              <button onClick={onDelete} className="btn btn-sm btn-error btn-outline">
                Delete account
              </button>
            </div>
          </div>
        )}

        {authUser && (
          <div className="rounded-xl border border-base-300 p-5 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Devices</h2>
              <p className="text-sm text-base-content/70">
                Where you're logged in. Revoke any device you don't recognize.
              </p>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm opacity-60">No active device sessions.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s._id} className="flex items-center gap-3 rounded-lg bg-base-200/50 p-3">
                    <Monitor className="size-5 opacity-70 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {deviceLabel(s.userAgent)}
                        {s.current && <span className="badge badge-primary badge-sm">This device</span>}
                      </div>
                      <div className="text-xs opacity-60 truncate">
                        {s.ip || "unknown IP"} · active {new Date(s.lastSeenAt).toLocaleString()}
                      </div>
                    </div>
                    {!s.current && (
                      <button onClick={() => onRevoke(s._id)} className="btn btn-xs btn-outline btn-error shrink-0">
                        Log out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {authUser && (
          <div className="rounded-xl border border-base-300 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Privacy</h2>
              <p className="text-sm text-base-content/70">Control what other people can see.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Last seen</span>
                <select
                  className="select select-bordered select-sm"
                  value={authUser.privacy?.lastSeen || "everyone"}
                  onChange={(e) => updatePrivacy({ lastSeen: e.target.value })}
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Profile photo</span>
                <select
                  className="select select-bordered select-sm"
                  value={authUser.privacy?.profilePhoto || "everyone"}
                  onChange={(e) => updatePrivacy({ profilePhoto: e.target.value })}
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={authUser.privacy?.readReceipts !== false}
                onChange={(e) => updatePrivacy({ readReceipts: e.target.checked })}
              />
              <div>
                <div className="text-sm font-medium">Read receipts</div>
                <div className="text-xs opacity-60">
                  When off, others won't see when you've read their messages.
                </div>
              </div>
            </label>
          </div>
        )}

        <div className="rounded-xl border border-base-300 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-base-content/70">
              Choose how DevChat looks. <span className="font-medium">System</span> follows your device.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key)}
                aria-pressed={mode === opt.key}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                  mode === opt.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 hover:bg-base-200"
                }`}
              >
                <opt.icon className="size-5" />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-1">Chat wallpaper</h3>
            <p className="text-xs text-base-content/60 mb-3">
              Personalize the conversation background.
            </p>
            <div className="flex flex-wrap gap-3">
              {CHAT_BACKGROUNDS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setBg(b.key)}
                  aria-pressed={bg === b.key}
                  className="flex flex-col items-center gap-1.5"
                  title={b.label}
                >
                  <span
                    className={`${b.class} size-14 rounded-xl border-2 ${
                      bg === b.key ? "border-primary" : "border-base-300"
                    }`}
                  />
                  <span className={`text-xs ${bg === b.key ? "text-primary font-medium" : "opacity-60"}`}>
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;