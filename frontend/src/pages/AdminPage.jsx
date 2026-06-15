import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";

const AdminPage = () => {
  const { authUser } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/admin/reports");
      setReports(res.data);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser?.isAdmin) load();
  }, [authUser, load]);

  if (!authUser) return <Navigate to="/login" />;
  if (!authUser.isAdmin)
    return <div className="pt-24 text-center text-base-content/60">Admins only.</div>;

  const resolve = async (id, status) => {
    await axiosInstance.patch(`/admin/reports/${id}`, { status });
    load();
  };

  return (
    <div className="max-w-2xl mx-auto pt-24 px-4 pb-10">
      <h1 className="text-2xl font-bold mb-4">Moderation — Open Reports</h1>
      {loading ? (
        <p>Loading…</p>
      ) : reports.length === 0 ? (
        <p className="opacity-60">No open reports 🎉</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r._id} className="border border-base-300 rounded-lg p-3">
              <p className="text-sm">
                <span className="opacity-60">Reason:</span> {r.reason}
              </p>
              <p className="text-sm">
                <span className="opacity-60">Message:</span>{" "}
                {r.messageId?.deletedAt
                  ? "(deleted)"
                  : r.messageId?.text || (r.messageId?.image ? "📷 image" : r.messageId?.audio ? "🎤 voice note" : "—")}
              </p>
              <p className="text-xs opacity-50">
                reported by {r.reporterId?.fullName || "unknown"} · status: {r.status}
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => resolve(r._id, "resolved")} className="btn btn-xs btn-success">
                  Resolve
                </button>
                <button onClick={() => resolve(r._id, "dismissed")} className="btn btn-xs">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
