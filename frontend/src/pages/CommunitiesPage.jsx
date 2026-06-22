import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Megaphone, Plus, ArrowLeft, DoorOpen, ShieldCheck, Loader2, Compass, Pencil, Camera, Wrench, Link2, Copy, Trash2, UserMinus, Ban } from "lucide-react";
import { useCommunityStore } from "../store/useCommunityStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "../components/Avatar";
import CreateCommunityModal from "../components/CreateCommunityModal";
import DiscoverCommunitiesModal from "../components/DiscoverCommunitiesModal";

const CommunitiesPage = () => {
  const {
    communities, active, loading, getCommunities, openCommunity,
    closeCommunity, leaveCommunity, createGroup, joinGroup, editGroupDescription,
    updateCommunity, setRole, createInvite, revokeInvite, removeMember,
  } = useCommunityStore();
  const { setSelectedUser } = useChatStore();
  const { authUser } = useAuthStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editDesc, setEditDesc] = useState("");
  const [editName, setEditName] = useState(false);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const avatarRef = useRef(null);

  const cid = active?.community?._id;
  const memberList = active?.community?.members || [];
  const roleOf = (uid) =>
    (active?.community?.admins || []).map(String).includes(String(uid))
      ? "admin"
      : (active?.community?.moderators || []).map(String).includes(String(uid))
        ? "moderator"
        : "member";
  const inviteUrl = (code) => `${window.location.origin}/communities/join/${code}`;

  const onCommunityPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onloadend = () => updateCommunity(cid, { avatar: reader.result });
    reader.readAsDataURL(f);
  };
  const openEdit = () => {
    setCName(active.community.name);
    setCDesc(active.community.description || "");
    setEditName(true);
  };
  const saveCommunity = async () => {
    const ok = await updateCommunity(cid, { name: cName.trim(), description: cDesc.trim() });
    if (ok) setEditName(false);
  };
  const copyInvite = (code) => {
    navigator.clipboard?.writeText(inviteUrl(code));
  };

  useEffect(() => {
    getCommunities();
  }, [getCommunities]);

  const openChat = (conv) => {
    if (!conv) return;
    setSelectedUser({ ...conv, fullName: conv.name, isGroup: true });
    navigate("/");
  };

  const submitGroup = async () => {
    if (!newGroup.trim() || !active) return;
    const ok = await createGroup(active.community._id, newGroup.trim());
    if (ok) {
      setNewGroup("");
      setAddingGroup(false);
    }
  };

  const joinedGroups = active ? active.groups.filter((g) => g.isMember) : [];
  const otherGroups = active ? active.groups.filter((g) => !g.isMember) : [];

  const startEdit = (g) => {
    setEditingGroupId(g._id);
    setEditDesc(g.description || "");
  };
  const saveEdit = async () => {
    const ok = await editGroupDescription(active.community._id, editingGroupId, editDesc.trim());
    if (ok) setEditingGroupId(null);
  };

  // one richer group row — avatar, description/member-count, open vs join
  // (community admins can edit the description inline)
  const renderGroup = (g) => {
    const editing = editingGroupId === g._id;
    return (
      <div key={g._id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-base-200/60">
        <Avatar group src={g.avatar} name={g.name} size="size-11" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{g.name}</div>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                autoFocus
                className="input input-bordered input-xs flex-1"
                placeholder="Group description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingGroupId(null);
                }}
              />
              <button onClick={saveEdit} className="btn btn-primary btn-xs">Save</button>
              <button onClick={() => setEditingGroupId(null)} className="btn btn-ghost btn-xs">Cancel</button>
            </div>
          ) : (
            <>
              {g.description && <div className="text-xs opacity-60 truncate">{g.description}</div>}
              <div className="flex items-center gap-2 mt-0.5">
                {g.memberPreview?.length > 0 && (
                  <div className="flex -space-x-2">
                    {g.memberPreview.map((m) => (
                      <Avatar key={m._id} user={m} size="size-5" className="ring-2 ring-base-100" />
                    ))}
                  </div>
                )}
                <span className="text-xs opacity-60">
                  {g.memberCount} member{g.memberCount > 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            {active.isAdmin && (
              <button
                onClick={() => startEdit(g)}
                className="btn btn-ghost btn-xs btn-circle"
                title="Edit description"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {g.isMember ? (
              <button onClick={() => openChat(g)} className="btn btn-sm btn-ghost">Open</button>
            ) : (
              <button onClick={() => joinGroup(active.community._id, g._id)} className="btn btn-sm btn-primary">
                Join
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-20 pb-10 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="size-6 text-primary" /> Communities
      </h1>

      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">
        {/* list */}
        <div className={`${active ? "hidden lg:block" : ""} space-y-2`}>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm flex-1 gap-2">
              <Plus className="size-4" /> New
            </button>
            <button onClick={() => setShowDiscover(true)} className="btn btn-outline btn-sm flex-1 gap-2">
              <Compass className="size-4" /> Discover
            </button>
          </div>
          {communities.length === 0 ? (
            <p className="text-sm opacity-60 text-center py-8">
              You're not in any communities yet. Create one to get started.
            </p>
          ) : (
            communities.map((c) => (
              <button
                key={c._id}
                onClick={() => openCommunity(c._id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  active?.community?._id === c._id ? "bg-primary/10" : "hover:bg-base-200"
                }`}
              >
                <Avatar group src={c.avatar} name={c.name} size="size-12" className="shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {c.name}
                    {c.isAdmin && <ShieldCheck className="size-3.5 text-primary shrink-0" />}
                  </div>
                  <div className="text-xs opacity-60">
                    {c.memberCount} member{c.memberCount > 1 ? "s" : ""} · {c.groupCount} group
                    {c.groupCount === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* detail */}
        <div className={`${active ? "" : "hidden lg:block"} min-w-0`}>
          {loading && !active ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="size-6 animate-spin text-base-content/40" />
            </div>
          ) : !active ? (
            <div className="hidden lg:grid place-items-center py-20 text-base-content/50">
              <Users className="size-12 mb-3 opacity-40" />
              <p>Select a community to view its channels.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* header */}
              <div className="flex items-start gap-4">
                <button onClick={closeCommunity} className="btn btn-ghost btn-sm btn-circle lg:hidden -ml-1">
                  <ArrowLeft className="size-5" />
                </button>
                <div className="relative shrink-0">
                  <Avatar group src={active.community.avatar} name={active.community.name} size="size-16" />
                  {active.isAdmin && (
                    <>
                      <button
                        onClick={() => avatarRef.current?.click()}
                        className="absolute -bottom-1 -right-1 btn btn-circle btn-xs btn-primary"
                        title="Change photo"
                      >
                        <Camera className="size-3" />
                      </button>
                      <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={onCommunityPhoto} />
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {editName ? (
                    <div className="space-y-2">
                      <input autoFocus className="input input-bordered input-sm w-full" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Community name" />
                      <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="Description" />
                      <div className="flex gap-2">
                        <button onClick={saveCommunity} disabled={!cName.trim()} className="btn btn-primary btn-xs">Save</button>
                        <button onClick={() => setEditName(false)} className="btn btn-ghost btn-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                        {active.community.name}
                        {active.isAdmin ? (
                          <span className="badge badge-primary badge-sm gap-1"><ShieldCheck className="size-3" /> Admin</span>
                        ) : active.isModerator ? (
                          <span className="badge badge-sm gap-1"><Wrench className="size-3" /> Mod</span>
                        ) : null}
                        {active.isAdmin && (
                          <button onClick={openEdit} className="btn btn-ghost btn-xs btn-circle" title="Edit community">
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </h2>
                      {active.community.description && (
                        <p className="text-sm text-base-content/70 mt-0.5">{active.community.description}</p>
                      )}
                      <p className="text-xs opacity-60 mt-1">
                        {memberList.length} member{memberList.length > 1 ? "s" : ""}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => leaveCommunity(active.community._id)}
                  className="btn btn-ghost btn-sm text-error gap-1"
                  title="Leave community"
                >
                  <DoorOpen className="size-4" /> Leave
                </button>
              </div>

              {/* announcement channel */}
              <div>
                <p className="text-xs uppercase tracking-wide opacity-50 mb-2">Announcement channel</p>
                <button
                  onClick={() => openChat(active.announcement)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-base-200/60 hover:bg-base-200 transition-colors"
                >
                  <span className="size-11 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
                    <Megaphone className="size-5" />
                  </span>
                  <div className="text-left min-w-0">
                    <div className="font-medium">Announcements</div>
                    <div className="text-xs opacity-60">
                      {active.isAdmin ? "Admins post · everyone reads" : "Important updates"}
                    </div>
                  </div>
                </button>
              </div>

              {/* groups */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide opacity-50">Groups</p>
                  {active.isAdmin && (
                    <button onClick={() => setAddingGroup((v) => !v)} className="btn btn-ghost btn-xs gap-1">
                      <Plus className="size-3.5" /> New group
                    </button>
                  )}
                </div>

                {addingGroup && (
                  <div className="flex gap-2 mb-2">
                    <input
                      autoFocus
                      className="input input-bordered input-sm flex-1"
                      placeholder="Group name"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitGroup()}
                    />
                    <button onClick={submitGroup} disabled={!newGroup.trim()} className="btn btn-primary btn-sm">
                      Add
                    </button>
                  </div>
                )}

                {active.groups.length === 0 ? (
                  <p className="text-sm opacity-60 py-4 text-center">
                    No groups yet.{active.isAdmin ? " Create the first one above." : ""}
                  </p>
                ) : (
                  <div className="space-y-5">
                    {/* groups you're in */}
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide opacity-50 mb-1.5">
                        YOUR GROUPS · {joinedGroups.length}
                      </p>
                      {joinedGroups.length === 0 ? (
                        <p className="text-xs opacity-50 px-1 py-2">
                          You haven't joined any groups here yet — pick one from Discover below.
                        </p>
                      ) : (
                        <div className="space-y-1.5">{joinedGroups.map(renderGroup)}</div>
                      )}
                    </div>

                    {/* groups available to join */}
                    {otherGroups.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide opacity-50 mb-1.5 flex items-center gap-1.5">
                          <Compass className="size-3.5" /> DISCOVER · {otherGroups.length} not joined
                        </p>
                        <div className="space-y-1.5">{otherGroups.map(renderGroup)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* members & roles (admins) */}
              {active.isAdmin && (
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-50 mb-2">Members &amp; roles</p>
                  <div className="space-y-1.5">
                    {memberList.map((m) => {
                      const r = roleOf(m._id);
                      return (
                        <div key={m._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-base-200/60">
                          <Avatar user={m} size="size-9" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {m.fullName}
                              {String(m._id) === String(authUser?._id) ? " (You)" : ""}
                            </div>
                            <div className="text-xs opacity-60 capitalize">{r}</div>
                          </div>
                          <select
                            className="select select-bordered select-xs"
                            value={r}
                            onChange={(e) => setRole(cid, m._id, e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="moderator">Moderator</option>
                            <option value="member">Member</option>
                          </select>
                          {String(m._id) !== String(authUser?._id) && (
                            <>
                              <button
                                onClick={() => removeMember(cid, m._id, false)}
                                className="btn btn-ghost btn-xs btn-circle"
                                title="Remove from community"
                              >
                                <UserMinus className="size-4" />
                              </button>
                              <button
                                onClick={() => removeMember(cid, m._id, true)}
                                className="btn btn-ghost btn-xs btn-circle text-error"
                                title="Remove & ban"
                              >
                                <Ban className="size-4" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* invite link (admins) */}
              {active.isAdmin && (
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-50 mb-2">Invite link</p>
                  {active.community.inviteCode ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        className="input input-bordered input-sm flex-1 text-xs"
                        value={inviteUrl(active.community.inviteCode)}
                        onFocus={(e) => e.target.select()}
                      />
                      <button onClick={() => copyInvite(active.community.inviteCode)} className="btn btn-sm btn-ghost gap-1">
                        <Copy className="size-4" /> Copy
                      </button>
                      <button onClick={() => revokeInvite(cid)} className="btn btn-sm btn-ghost text-error" title="Disable link">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => createInvite(cid)} className="btn btn-sm btn-outline gap-1">
                      <Link2 className="size-4" /> Create invite link
                    </button>
                  )}
                  <p className="text-xs opacity-50 mt-1">Anyone with this link can join the community.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateCommunityModal onClose={() => setShowCreate(false)} onCreated={(id) => openCommunity(id)} />
      )}
      {showDiscover && (
        <DiscoverCommunitiesModal onClose={() => setShowDiscover(false)} onJoined={(id) => openCommunity(id)} />
      )}
    </div>
  );
};

export default CommunitiesPage;
