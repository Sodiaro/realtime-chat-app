import { useRef, useState } from "react";
import { UserMinus, LogOut, Plus, Check, Camera, Link as LinkIcon, Copy, RefreshCw, Ban, Shield, ShieldOff, UsersRound } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import toast from "react-hot-toast";

const GroupInfoModal = ({ conversation, onClose }) => {
  const {
    users, renameGroup, updateGroupInfo, addGroupMembers, removeGroupMember,
    leaveGroup, setGroupAdmin, createInvite, revokeInvite,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const myId = authUser._id;
  const photoRef = useRef(null);

  const isAdmin = (conversation.admins || []).some((id) => (id?._id || id) === myId);
  const memberIds = (conversation.participants || []).map((p) => p?._id || p);

  const members = (conversation.participants || []).map((p) => {
    if (p && p.fullName) return p;
    const id = p?._id || p;
    if (id === myId) return authUser;
    return users.find((u) => u._id === id) || { _id: id, fullName: "Member" };
  });

  const [name, setName] = useState(conversation.name || "");
  const [desc, setDesc] = useState(conversation.description || "");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState([]);
  const [inviteCode, setInviteCode] = useState(null);

  const candidates = users.filter((u) => !memberIds.includes(u._id));
  const isGroupAdmin = (id) => (conversation.admins || []).some((a) => (a?._id || a) === id);
  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";

  const saveName = () => {
    if (name.trim() && name.trim() !== conversation.name) renameGroup(conversation._id, name.trim());
  };
  const saveDesc = () => {
    if (desc !== (conversation.description || "")) updateGroupInfo(conversation._id, { description: desc });
  };
  const onPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateGroupInfo(conversation._id, { avatar: reader.result });
    reader.readAsDataURL(file);
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
  const getInvite = async (rotate = false) => {
    const code = await createInvite(conversation._id, rotate);
    if (code) setInviteCode(code);
  };
  const killInvite = async () => {
    await revokeInvite(conversation._id);
    setInviteCode(null);
  };
  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteUrl);
    toast.success("Invite link copied");
  };

  return (
    <Modal
      title="Group info"
      onClose={onClose}
      footer={
        <Button variant="error" size="sm" onClick={doLeave} className="w-full gap-2">
          <LogOut className="size-4" /> Leave group
        </Button>
      }
    >
      <div className="space-y-4">
          {/* photo */}
          <div className="flex flex-col items-center">
            <div className="relative">
              {conversation.avatar ? (
                <img src={conversation.avatar} alt="" className="size-20 rounded-3xl object-cover" />
              ) : (
                <div className="size-20 rounded-3xl grid place-items-center bg-primary/10 text-primary">
                  <UsersRound className="size-9" />
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => photoRef.current?.click()}
                  className="absolute -bottom-1 -right-1 btn btn-xs btn-circle btn-primary"
                  title="Change photo"
                >
                  <Camera className="size-3.5" />
                </button>
              )}
              <input type="file" accept="image/*" ref={photoRef} className="hidden" onChange={onPhoto} />
            </div>
          </div>

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

          {/* description */}
          <div>
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={2}
              placeholder={isAdmin ? "Add a group description…" : "No description"}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={saveDesc}
              disabled={!isAdmin}
            />
          </div>

          {/* admin controls */}
          {isAdmin && (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={Boolean(conversation.onlyAdminsCanMessage)}
                  onChange={(e) =>
                    updateGroupInfo(conversation._id, { onlyAdminsCanMessage: e.target.checked })
                  }
                />
                <span className="text-sm">Only admins can send messages</span>
              </label>

              {/* invite link */}
              <div className="rounded-lg border border-base-300 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LinkIcon className="size-4" /> Invite link
                </div>
                {inviteCode ? (
                  <>
                    <div className="flex items-center gap-1">
                      <input readOnly value={inviteUrl} className="input input-bordered input-xs flex-1" />
                      <button onClick={copyInvite} className="btn btn-xs btn-ghost btn-circle" title="Copy">
                        <Copy className="size-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => getInvite(true)} className="btn btn-xs btn-ghost gap-1">
                        <RefreshCw className="size-3.5" /> Reset
                      </button>
                      <button onClick={killInvite} className="btn btn-xs btn-ghost text-error gap-1">
                        <Ban className="size-3.5" /> Disable
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => getInvite(false)} className="btn btn-sm btn-outline w-full">
                    Get invite link
                  </button>
                )}
              </div>
            </>
          )}

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
                  <Avatar user={m} size="size-8" />
                  <span className="text-sm truncate">{m._id === myId ? "You" : m.fullName}</span>
                  {isGroupAdmin(m._id) && <span className="badge badge-ghost badge-xs">admin</span>}
                  {isAdmin && m._id !== myId && (
                    <div className="ml-auto flex items-center">
                      <button
                        onClick={() => setGroupAdmin(conversation._id, m._id, !isGroupAdmin(m._id))}
                        className="btn btn-ghost btn-xs btn-circle"
                        title={isGroupAdmin(m._id) ? "Remove admin" : "Make admin"}
                      >
                        {isGroupAdmin(m._id) ? <ShieldOff className="size-4" /> : <Shield className="size-4" />}
                      </button>
                      <button
                        onClick={() => removeGroupMember(conversation._id, m._id)}
                        className="btn btn-ghost btn-xs btn-circle text-error"
                        title="Remove"
                      >
                        <UserMinus className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
      </div>
    </Modal>
  );
};

export default GroupInfoModal;
