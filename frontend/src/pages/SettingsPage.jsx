import { useState } from "react";
import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import { Send } from "lucide-react";

const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going?", isSent: false },
  { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const SettingsPage = () => {
  const { theme, setTheme } = useThemeStore();
  const { authUser, changePassword, logoutAllDevices, deleteAccount, updatePrivacy } = useAuthStore();

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

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

        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Theme</h2>
          <p className="text-sm text-base-content/70">Choose a theme for your chat interface</p>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              className={`
                group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors
                ${theme === t ? "bg-base-200" : "hover:bg-base-200/50"}
              `}
              onClick={() => setTheme(t)}
            >
              <div className="relative h-8 w-full rounded-md overflow-hidden" data-theme={t}>
                <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
                  <div className="rounded bg-primary"></div>
                  <div className="rounded bg-secondary"></div>
                  <div className="rounded bg-accent"></div>
                  <div className="rounded bg-neutral"></div>
                </div>
              </div>
              <span className="text-[11px] font-medium truncate w-full text-center">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            </button>
          ))}
        </div>

        {/* Preview Section */}
        <h3 className="text-lg font-semibold mb-3">Preview</h3>
        <div className="rounded-xl border border-base-300 overflow-hidden bg-base-100 shadow-lg">
          <div className="p-4 bg-base-200">
            <div className="max-w-lg mx-auto">
              {/* Mock Chat UI */}
              <div className="bg-base-100 rounded-xl shadow-sm overflow-hidden">
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-base-300 bg-base-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-content font-medium">
                      J
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">John Doe</h3>
                      <p className="text-xs text-base-content/70">Online</p>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="p-4 space-y-4 min-h-[200px] max-h-[200px] overflow-y-auto bg-base-100">
                  {PREVIEW_MESSAGES.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isSent ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`
                          max-w-[80%] rounded-xl p-3 shadow-sm
                          ${message.isSent ? "bg-primary text-primary-content" : "bg-base-200"}
                        `}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`
                            text-[10px] mt-1.5
                            ${message.isSent ? "text-primary-content/70" : "text-base-content/70"}
                          `}
                        >
                          12:00 PM
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-base-300 bg-base-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input input-bordered flex-1 text-sm h-10"
                      placeholder="Type a message..."
                      value="This is a preview"
                      readOnly
                    />
                    <button className="btn btn-primary h-10 min-h-0">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;