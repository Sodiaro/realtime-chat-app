import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "../store/useThemeStore";
import { useChatBgStore, CHAT_BACKGROUNDS } from "../store/useChatBgStore";
import { usePrefsStore } from "../store/usePrefsStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import Avatar from "../components/Avatar";
import {
  Monitor, Sun, Moon, User, Shield, Bell, MessageSquare, Palette, Timer,
  Ban, Archive, HardDrive, Lock, Camera, Ghost,
} from "lucide-react";

// turn a raw user-agent string into a friendly "Browser · OS" label
const deviceLabel = (ua = "") => {
  const browser = /edg/i.test(ua) ? "Edge"
    : /chrome|crios/i.test(ua) ? "Chrome"
    : /firefox|fxios/i.test(ua) ? "Firefox"
    : /safari/i.test(ua) ? "Safari" : "Browser";
  const os = /windows/i.test(ua) ? "Windows"
    : /android/i.test(ua) ? "Android"
    : /iphone|ipad|ios/i.test(ua) ? "iOS"
    : /mac/i.test(ua) ? "macOS"
    : /linux/i.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} · ${os}`;
};

const DISAPPEAR_OPTIONS = [
  { l: "Off", m: 0 },
  { l: "1 day", m: 1440 },
  { l: "1 week", m: 10080 },
];

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "chat", label: "Chat preferences", icon: MessageSquare },
  { id: "appearance", label: "Theme & appearance", icon: Palette },
  { id: "disappearing", label: "Disappearing defaults", icon: Timer },
  { id: "blocked", label: "Blocked users", icon: Ban },
  { id: "archived", label: "Archived chats", icon: Archive },
  { id: "storage", label: "Media & storage", icon: HardDrive },
  { id: "security", label: "Security", icon: Lock },
  { id: "account", label: "Account", icon: User },
];

const Card = ({ id, title, desc, children }) => (
  <section id={id} className="scroll-mt-24 rounded-xl border border-base-300 p-5 space-y-4">
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc && <p className="text-sm text-base-content/70">{desc}</p>}
    </div>
    {children}
  </section>
);

const Toggle = ({ checked, onChange, title, desc }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={checked} onChange={onChange} />
    <div>
      <div className="text-sm font-medium">{title}</div>
      {desc && <div className="text-xs opacity-60">{desc}</div>}
    </div>
  </label>
);

const SettingsPage = () => {
  const { mode, setMode } = useThemeStore();
  const { bg, setBg } = useChatBgStore();
  const {
    soundEnabled, setSound, enterToSend, setEnterToSend, disappearingDefault, setDisappearingDefault,
  } = usePrefsStore();
  const {
    authUser, updateProfile, isUpdatingProfile, blockUser, changePassword,
    logoutAllDevices, deleteAccount, updatePrivacy, getSessions, revokeSession,
  } = useAuthStore();
  const { users, conversations } = useChatStore();

  const THEME_OPTIONS = [
    { key: "system", label: "System", icon: Monitor },
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];

  const [username, setUsername] = useState(authUser?.username || "");
  const [bio, setBio] = useState(authUser?.bio || "");
  const [status, setStatus] = useState(authUser?.status || "");
  const fileRef = useRef(null);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [sessions, setSessions] = useState([]);
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    (async () => {
      const data = await getSessions();
      if (active) setSessions(data);
    })();
    return () => { active = false; };
  }, [authUser, getSessions]);

  if (!authUser) return null;

  const blocked = (authUser.blockedUsers || []).map(
    (id) => users.find((u) => u._id === id) || { _id: id, fullName: "User" }
  );
  const archivedCount = conversations.filter((c) => c.isArchived).length;
  const dirtyProfile =
    username !== (authUser.username || "") || bio !== (authUser.bio || "") || status !== (authUser.status || "");

  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onloadend = () => updateProfile({ profilePic: reader.result });
    reader.readAsDataURL(f);
  };
  const saveProfile = () => updateProfile({ username: username.trim(), bio: bio.trim(), status: status.trim() });
  const requestNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };
  const onRevoke = async (id) => {
    const ok = await revokeSession(id);
    if (ok) setSessions((s) => s.filter((x) => x._id !== id));
  };
  const onChangePassword = async () => {
    if (!curPw || !newPw) return;
    const ok = await changePassword(curPw, newPw);
    if (ok) { setCurPw(""); setNewPw(""); }
  };
  const onDelete = async () => {
    if (window.confirm("Delete your account permanently? This cannot be undone.")) await deleteAccount();
  };
  const resetPrefs = () => {
    setSound(true); setEnterToSend(true); setDisappearingDefault(0); setBg("doodle"); setMode("system");
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-20 pb-10 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* section nav (desktop) */}
        <nav className="hidden lg:block sticky top-20 self-start space-y-1">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200 hover:text-base-content transition-colors"
            >
              <s.icon className="size-4" /> {s.label}
            </a>
          ))}
        </nav>

        <div className="space-y-6 min-w-0">
          {/* PROFILE */}
          <Card id="profile" title="Profile" desc="Your public identity. Name is shown to everyone you chat with.">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar user={authUser} size="size-20" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 btn btn-circle btn-xs btn-primary"
                  title="Change photo"
                  disabled={isUpdatingProfile}
                >
                  <Camera className="size-3.5" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-lg truncate">{authUser.fullName}</div>
                <div className="text-sm opacity-60">{isUpdatingProfile ? "Uploading…" : "Tap the camera to update your photo"}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Username</span>
                <input className="input input-bordered input-sm" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Status</span>
                <input className="input input-bordered input-sm" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Available" />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Bio</span>
              <textarea className="textarea textarea-bordered" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio…" />
            </label>
            <button onClick={saveProfile} disabled={!dirtyProfile || isUpdatingProfile} className="btn btn-primary btn-sm">
              Save profile
            </button>
          </Card>

          {/* PRIVACY */}
          <Card id="privacy" title="Privacy" desc="Control what other people can see.">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Last seen</span>
                <select className="select select-bordered select-sm" value={authUser.privacy?.lastSeen || "everyone"} onChange={(e) => updatePrivacy({ lastSeen: e.target.value })}>
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Profile photo</span>
                <select className="select select-bordered select-sm" value={authUser.privacy?.profilePhoto || "everyone"} onChange={(e) => updatePrivacy({ profilePhoto: e.target.value })}>
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
            </div>
            <Toggle
              checked={authUser.privacy?.readReceipts !== false}
              onChange={(e) => updatePrivacy({ readReceipts: e.target.checked })}
              title="Read receipts"
              desc="When off, others won't see when you've read their messages."
            />
            <div className="rounded-lg border border-base-300 p-3 space-y-2">
              <Toggle
                checked={!!authUser.ghostMode}
                onChange={(e) => updatePrivacy({ ghostMode: e.target.checked })}
                title="Ghost mode"
                desc="Appear offline, hide your profile photo, last seen, typing, read receipts, status views and edit/delete marks."
              />
              <ul className="text-xs text-base-content/60 pl-9 list-disc space-y-0.5">
                <li>You show as offline and your profile photo is hidden</li>
                <li>You read, type, and view statuses invisibly</li>
                <li>People can't call you (treated as Do Not Disturb)</li>
                <li>You can recover messages others delete in your chats (“view original”)</li>
              </ul>
              <p className="text-xs text-base-content/60 pl-9">
                You stay findable and people can still message you — but they'll see a{" "}
                <span className="inline-flex items-center gap-0.5 font-medium"><Ghost className="size-3" />Ghost</span>{" "}
                badge so it's clear some activity is hidden.
              </p>
            </div>
          </Card>

          {/* NOTIFICATIONS */}
          <Card id="notifications" title="Notifications" desc="How DevChat alerts you to new activity.">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-base-200/50 p-3">
              <div>
                <div className="text-sm font-medium">Desktop notifications</div>
                <div className="text-xs opacity-60">
                  {notifPerm === "granted" ? "Enabled" : notifPerm === "denied" ? "Blocked in your browser settings" : "Not enabled yet"}
                </div>
              </div>
              {notifPerm !== "granted" && notifPerm !== "denied" && notifPerm !== "unsupported" && (
                <button onClick={requestNotif} className="btn btn-sm btn-primary">Enable</button>
              )}
            </div>
            <Toggle
              checked={soundEnabled}
              onChange={(e) => setSound(e.target.checked)}
              title="In-app sounds"
              desc="Play a sound when a new message arrives."
            />
          </Card>

          {/* CHAT PREFERENCES */}
          <Card id="chat" title="Chat preferences" desc="Tune how the conversation view behaves.">
            <Toggle
              checked={enterToSend}
              onChange={(e) => setEnterToSend(e.target.checked)}
              title="Press Enter to send"
              desc={enterToSend ? "Shift+Enter inserts a new line." : "Enter inserts a new line; Ctrl/⌘+Enter sends."}
            />
            <div>
              <h3 className="text-sm font-semibold mb-1">Chat wallpaper</h3>
              <p className="text-xs text-base-content/60 mb-3">Personalize the conversation background.</p>
              <div className="flex flex-wrap gap-3">
                {CHAT_BACKGROUNDS.map((b) => (
                  <button key={b.key} onClick={() => setBg(b.key)} aria-pressed={bg === b.key} className="flex flex-col items-center gap-1.5" title={b.label}>
                    <span className={`${b.class} size-14 rounded-xl border-2 ${bg === b.key ? "border-primary" : "border-base-300"}`} />
                    <span className={`text-xs ${bg === b.key ? "text-primary font-medium" : "opacity-60"}`}>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* APPEARANCE */}
          <Card id="appearance" title="Theme & appearance" desc="System follows your device.">
            <div className="grid grid-cols-3 gap-2 max-w-md">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  aria-pressed={mode === opt.key}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                    mode === opt.key ? "border-primary bg-primary/10 text-primary" : "border-base-300 hover:bg-base-200"
                  }`}
                >
                  <opt.icon className="size-5" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* DISAPPEARING DEFAULTS */}
          <Card id="disappearing" title="Disappearing message defaults" desc="Applied automatically to new direct chats you start. Existing chats are unaffected.">
            <div className="flex gap-1 bg-base-200/60 rounded-lg p-1 max-w-xs">
              {DISAPPEAR_OPTIONS.map((o) => (
                <button
                  key={o.m}
                  onClick={() => setDisappearingDefault(o.m)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    disappearingDefault === o.m ? "bg-primary text-primary-content" : "hover:bg-base-300"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </Card>

          {/* BLOCKED USERS */}
          <Card id="blocked" title="Blocked users" desc="Blocked people can't message or call you.">
            {blocked.length === 0 ? (
              <p className="text-sm opacity-60">You haven't blocked anyone.</p>
            ) : (
              <div className="space-y-2">
                {blocked.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 rounded-lg bg-base-200/50 p-2.5">
                    <Avatar user={u} size="size-9" />
                    <span className="flex-1 truncate font-medium">{u.fullName}</span>
                    <button onClick={() => blockUser(u._id)} className="btn btn-xs btn-outline">Unblock</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ARCHIVED CHATS */}
          <Card id="archived" title="Archived chats" desc="Conversations you've tucked away.">
            <p className="text-sm">
              {archivedCount === 0
                ? "No archived conversations."
                : `${archivedCount} archived conversation${archivedCount > 1 ? "s" : ""}.`}
            </p>
            <p className="text-xs opacity-60">Open the “Archived” entry at the top of your chat list to view or restore them.</p>
          </Card>

          {/* MEDIA & STORAGE */}
          <Card id="storage" title="Media & storage" desc="Where your data lives.">
            <p className="text-sm text-base-content/70">
              Photos, voice notes and files you share are stored securely in the cloud and streamed on demand — nothing large is kept on this device.
            </p>
            <button onClick={resetPrefs} className="btn btn-sm btn-outline">Reset local preferences</button>
            <p className="text-xs opacity-60">Resets theme, wallpaper, sounds and send/disappearing preferences on this device.</p>
          </Card>

          {/* SECURITY */}
          <Card id="security" title="Security" desc="Password and active devices.">
            <div className="grid sm:grid-cols-2 gap-3">
              <input type="password" className="input input-bordered input-sm" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
              <input type="password" className="input input-bordered input-sm" placeholder="New password (min 6)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <button onClick={onChangePassword} disabled={!curPw || !newPw} className="btn btn-primary btn-sm">Change password</button>

            <div className="pt-2 border-t border-base-300">
              <h3 className="text-sm font-semibold mb-2">Active devices</h3>
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
                        <button onClick={() => onRevoke(s._id)} className="btn btn-xs btn-outline btn-error shrink-0">Log out</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={logoutAllDevices} className="btn btn-sm btn-outline mt-3">Log out all other devices</button>
            </div>
          </Card>

          {/* ACCOUNT */}
          <Card id="account" title="Account" desc="Manage your DevChat account.">
            <button onClick={onDelete} className="btn btn-sm btn-error btn-outline">Delete account</button>
            <p className="text-xs opacity-60">This permanently removes your account and cannot be undone.</p>
          </Card>
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
