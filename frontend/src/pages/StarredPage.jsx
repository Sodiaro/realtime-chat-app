import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
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
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Star className="size-6 text-amber-400 fill-amber-400" /> Starred messages
      </h1>
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
