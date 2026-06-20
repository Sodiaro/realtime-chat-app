import { useEffect, useState } from "react";
import { axiosInstance } from "../../lib/axios";
import { formatMessageTime } from "../../lib/utils";

const preview = (m) =>
  m.text ||
  (m.image ? "📷 Photo" : m.audio ? "🎤 Voice note" : m.file ? "📎 File" : m.poll ? "📊 Poll" : "—");

const StarredPanel = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/messages/starred");
        if (active) setItems(res.data);
      } catch {
        /* non-fatal */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p className="p-4 opacity-60">Loading…</p>;
  if (items.length === 0)
    return (
      <p className="p-8 opacity-60 text-center text-sm">
        No starred messages yet. Open a message's menu and tap Star.
      </p>
    );

  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div key={m._id} className="rounded-xl bg-base-200 p-3">
          <p className="text-sm break-words">{preview(m)}</p>
          <time className="text-xs opacity-50">{formatMessageTime(m.createdAt)}</time>
        </div>
      ))}
    </div>
  );
};

export default StarredPanel;
