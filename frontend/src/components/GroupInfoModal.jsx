import { useState } from "react";
import { X, UserMinus, LogOut, Plus, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const GroupInfoModal = ({ conversation, onClose }) => {
  const { users, renameGroup, addGroupMembers, removeGroupMember, leaveGroup } = useChatStore();
  const { authUser } = useAuthStore();
  const myId = authUser._id;

  const isAdmin = (conversation.admins || []).some((id) => (id?._id || id) === myId);
  const memberIds = (conversation.participants || []).map((p) => p?._id || p);

  // resolve participant ids to user objects (handles populated or raw ids)
  const members = (conversation.participants || []).map((p) => {
    if (p && p.fullName) return p;
    const id = p?._id || p;
    if (id === myId) return authUser;
    return users.find((u) => u._id === id) || { _id: id, fullName: "Member" };
  });

  const [name, setName] = useState(conversation.name || "");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState([]);

  const candidates = users.filter((u) => !memberIds.includes(u._id));

  const saveName = () => {
    if (name.trim() && name.trim() !== conversation.name) renameGroup(conversation._id, name.trim());
  };
  const doAdd = async () => {
    if (toAdd.length) await addGroupMembers(conversation._id, toAdd);
    setToAdd([]);
    setAdding(false);
  };
  const doLeave = async () => {
    await leaveGroup(conversation._id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl w-96 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h3 className="font-medium">Group info</h3>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* name */}
          <div className="flex items-center gap-2">
            <input
              className="input input-bordered input-sm flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
            />
            {isAdmin && (
              <button onClick={saveName} className="btn btn-sm btn-primary btn-circle" title="Save name">
                <Check className="size-4" />
              </button>
            )}
          </div>

          {/* members */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm opacity-60">{members.length} members</p>
              {isAdmin && (
                <button onClick={() => setAdding((v) => !v)} className="btn btn-ghost btn-xs gap-1">
                  <Plus className="size-4" /> Add
                </button>
              )}
            </div>

            {adding && (
              <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-base-300">
                {candidates.length === 0 && <p className="p-2 text-sm opacity-60">No one to add</p>}
                {candidates.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-base-200">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={toAdd.includes(u._id)}
                      onChange={() =>
                        setToAdd((s) => (s.includes(u._id) ? s.filter((x) => x !== u._id) : [...s, u._id]))
                      }
                    />
                    <span className="text-sm truncate">{u.fullName}</span>
                  </label>
                ))}
                {candidates.length > 0 && (
                  <button onClick={doAdd} disabled={!toAdd.length} className="btn btn-primary btn-sm w-full">
                    Add ({toAdd.length})
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1">
              {members.map((m) => (
                <div key={m._id} className="flex items-center gap-2 p-1">
                  <img src={m.profilePic || "/avatar.png"} className="size-8 rounded-full" alt="" />
                  <span className="text-sm truncate">{m._id === myId ? "You" : m.fullName}</span>
                  {(conversation.admins || []).some((id) => (id?._id || id) === m._id) && (
                    <span className="badge badge-ghost badge-xs">admin</span>
                  )}
                  {isAdmin && m._id !== myId && (
                    <button
                      onClick={() => removeGroupMember(conversation._id, m._id)}
                      className="ml-auto btn btn-ghost btn-xs btn-circle text-error"
                      title="Remove"
                    >
                      <UserMinus className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-base-300">
          <button onClick={doLeave} className="btn btn-error btn-sm btn-outline w-full gap-2">
            <LogOut className="size-4" /> Leave group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
