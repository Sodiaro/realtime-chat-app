import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Megaphone, Hash, Plus, ArrowLeft, DoorOpen, ShieldCheck, Loader2 } from "lucide-react";
import { useCommunityStore } from "../store/useCommunityStore";
import { useChatStore } from "../store/useChatStore";
import Avatar from "../components/Avatar";
import CreateCommunityModal from "../components/CreateCommunityModal";

const CommunitiesPage = () => {
  const {
    communities, active, loading, getCommunities, openCommunity,
    closeCommunity, leaveCommunity, createGroup, joinGroup,
  } = useCommunityStore();
  const { setSelectedUser } = useChatStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

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

  return (
    <div className="min-h-screen container mx-auto px-4 pt-20 pb-10 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="size-6 text-primary" /> Communities
      </h1>

      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">
        {/* list */}
        <div className={`${active ? "hidden lg:block" : ""} space-y-2`}>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm w-full gap-2">
            <Plus className="size-4" /> New community
          </button>
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
                <Avatar group src={active.community.avatar} name={active.community.name} size="size-16" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {active.community.name}
                    {active.isAdmin && (
                      <span className="badge badge-primary badge-sm gap-1">
                        <ShieldCheck className="size-3" /> Admin
                      </span>
                    )}
                  </h2>
                  {active.community.description && (
                    <p className="text-sm text-base-content/70 mt-0.5">{active.community.description}</p>
                  )}
                  <p className="text-xs opacity-60 mt-1">
                    {(active.community.members?.length ?? 0)} member
                    {(active.community.members?.length ?? 0) > 1 ? "s" : ""}
                  </p>
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
                  <p className="text-sm opacity-60 py-4 text-center">No groups yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {active.groups.map((g) => (
                      <div key={g._id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-base-200/60">
                        <span className="size-10 rounded-full bg-base-300/70 grid place-items-center shrink-0">
                          <Hash className="size-4 opacity-70" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="text-xs opacity-60">
                            {g.memberCount} member{g.memberCount > 1 ? "s" : ""}
                          </div>
                        </div>
                        {g.isMember ? (
                          <button onClick={() => openChat(g)} className="btn btn-sm btn-ghost">Open</button>
                        ) : (
                          <button onClick={() => joinGroup(active.community._id, g._id)} className="btn btn-sm btn-primary">
                            Join
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateCommunityModal onClose={() => setShowCreate(false)} onCreated={(id) => openCommunity(id)} />
      )}
    </div>
  );
};

export default CommunitiesPage;
