import { useEffect, useState } from "react";
import { X, FileText, Download, Image as ImageIcon, Link as LinkIcon, Paperclip } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import Lightbox from "./Lightbox";

const TABS = [
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "files", label: "Files", icon: Paperclip },
  { key: "links", label: "Links", icon: LinkIcon },
];

const fmtSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// All photos / files / links shared in a conversation (whole history).
const SharedMediaModal = ({ conversationId, onClose }) => {
  const [tab, setTab] = useState("media");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await axiosInstance.get(`/messages/conversation/${conversationId}/shared`, {
          params: { type: tab },
        });
        if (active) setItems(res.data);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [conversationId, tab]);

  return (
    <>
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onClick={onClose}>
        <div
          className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-base-100 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-base-300">
            <h3 className="font-semibold">Shared content</h3>
            <button onClick={onClose}>
              <X className="size-5" />
            </button>
          </div>

          <div className="flex border-b border-base-300">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 text-sm flex items-center justify-center gap-1.5 ${
                  tab === t.key ? "border-b-2 border-primary text-primary font-medium" : "opacity-60"
                }`}
              >
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto p-4 flex-1">
            {loading ? (
              <p className="opacity-60 text-sm text-center py-6">Loading…</p>
            ) : items.length === 0 ? (
              <p className="opacity-60 text-sm text-center py-6">Nothing here yet</p>
            ) : tab === "media" ? (
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((m) => (
                  <button key={m._id} onClick={() => setZoom(m.image)}>
                    <img
                      src={m.image}
                      alt=""
                      className="aspect-square w-full object-cover rounded-lg cursor-zoom-in"
                    />
                  </button>
                ))}
              </div>
            ) : tab === "files" ? (
              <div className="space-y-2">
                {items.map((m) => (
                  <a
                    key={m._id}
                    href={m.file?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-2 rounded-lg bg-base-200/60 hover:bg-base-200"
                  >
                    <div className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{m.file?.name}</div>
                      <div className="text-xs opacity-60">{fmtSize(m.file?.size || 0)}</div>
                    </div>
                    <Download className="size-4 opacity-60 shrink-0" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((m) => (
                  <a
                    key={m._id}
                    href={m.linkPreview?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-2 rounded-lg bg-base-200/60 hover:bg-base-200"
                  >
                    <div className="text-sm font-medium truncate">
                      {m.linkPreview?.title || m.linkPreview?.url}
                    </div>
                    <div className="text-xs opacity-60 truncate">{m.linkPreview?.url}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </>
  );
};

export default SharedMediaModal;
