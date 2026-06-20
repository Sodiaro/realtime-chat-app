import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import PageHeader from "../components/ui/PageHeader";
import { Star } from "lucide-react";
import { formatMessageTime } from "../lib/utils";

const StarredPage = () => {
  const { authUser } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/messages/starred");
      setItems(res.data);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser) load();
  }, [authUser, load]);

  if (!authUser) return <Navigate to="/login" />;

  return (
    <div className="max-w-2xl mx-auto pt-24 px-4 pb-10">
      <PageHeader icon={Star} title="Starred messages" subtitle="Messages you've saved for later" />
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="opacity-60">No starred messages yet. Hover a message and tap the star.</p>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m._id} className="border border-base-300 rounded-lg p-3">
              <p className="text-sm">
                {m.text || (m.image ? "📷 Photo" : m.audio ? "🎤 Voice note" : "—")}
              </p>
              <time className="text-xs opacity-50">{formatMessageTime(m.createdAt)}</time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StarredPage;
