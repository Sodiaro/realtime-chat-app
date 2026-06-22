import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, Loader2 } from "lucide-react";
import { useCommunityStore } from "../store/useCommunityStore";
import Avatar from "../components/Avatar";

const CommunityJoinPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { previewInvite, joinByInvite, openCommunity } = useCommunityStore();
  const [preview, setPreview] = useState(undefined); // undefined = loading, null = invalid
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await previewInvite(code);
      if (active) setPreview(p);
    })();
    return () => {
      active = false;
    };
  }, [code, previewInvite]);

  const open = async (id) => {
    await openCommunity(id);
    navigate("/communities");
  };
  const join = async () => {
    setJoining(true);
    const id = await joinByInvite(code);
    setJoining(false);
    if (id) open(id);
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 pt-16">
      <div className="bg-base-100 border border-base-300 rounded-2xl p-8 text-center w-80 shadow-card">
        {preview === undefined ? (
          <Loader2 className="size-6 animate-spin mx-auto text-base-content/40" />
        ) : !preview ? (
          <>
            <p className="opacity-70">This invite is invalid or has expired.</p>
            <button onClick={() => navigate("/communities")} className="btn btn-sm btn-ghost mt-4">
              Back to communities
            </button>
          </>
        ) : (
          <>
            <Avatar group src={preview.avatar} name={preview.name} size="size-20" className="mx-auto" />
            <h2 className="text-lg font-semibold mt-3">{preview.name}</h2>
            {preview.description && <p className="text-sm opacity-70 mt-1">{preview.description}</p>}
            <p className="text-xs opacity-60 mt-1">
              {preview.memberCount} member{preview.memberCount > 1 ? "s" : ""}
            </p>
            {preview.isMember ? (
              <button onClick={() => open(preview._id)} className="btn btn-primary btn-sm mt-5 w-full">
                Open community
              </button>
            ) : (
              <button onClick={join} disabled={joining} className="btn btn-primary btn-sm mt-5 w-full gap-1">
                <Users className="size-4" /> {joining ? "Joining…" : "Join community"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CommunityJoinPage;
