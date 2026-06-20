import { useEffect, useState } from "react";
import { Navigate, useParams, useNavigate, Link } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { UsersRound, Loader } from "lucide-react";

const JoinGroupPage = () => {
  const { code } = useParams();
  const { authUser } = useAuthStore();
  const { setSelectedUser, getConversations } = useChatStore();
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | invalid
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get(`/messages/invite/${code}`);
        if (active) {
          setPreview(res.data);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, [code, authUser]);

  if (!authUser) return <Navigate to="/login" />;

  const join = async () => {
    setJoining(true);
    try {
      const res = await axiosInstance.post(`/messages/invite/${code}/join`);
      await getConversations();
      setSelectedUser({ ...res.data, fullName: res.data.name });
      navigate("/");
    } catch {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-base-300 p-6 text-center">
        {status === "loading" && <Loader className="size-8 animate-spin mx-auto" />}

        {status === "invalid" && (
          <>
            <p className="text-lg font-semibold">Invalid or expired invite</p>
            <p className="text-sm opacity-60 mt-1">This group link is no longer active.</p>
            <Link to="/" className="btn btn-primary btn-sm mt-4">
              Back to chats
            </Link>
          </>
        )}

        {status === "ready" && preview && (
          <>
            {preview.avatar ? (
              <img src={preview.avatar} alt="" className="size-20 rounded-3xl mx-auto object-cover" />
            ) : (
              <div className="size-20 rounded-3xl mx-auto grid place-items-center bg-primary/10 text-primary">
                <UsersRound className="size-9" />
              </div>
            )}
            <h1 className="text-xl font-bold mt-3">{preview.name}</h1>
            {preview.description && <p className="text-sm opacity-70 mt-1">{preview.description}</p>}
            <p className="text-sm text-primary mt-1">{preview.memberCount} members</p>
            <button onClick={join} disabled={joining} className="btn btn-primary w-full mt-5">
              {preview.isMember ? "Open group" : joining ? "Joining…" : "Join group"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinGroupPage;
