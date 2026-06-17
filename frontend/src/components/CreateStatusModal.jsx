import { useState } from "react";
import { X, Type, Image as ImageIcon } from "lucide-react";
import { useStatusStore } from "../store/useStatusStore";

const COLORS = ["#16a34a", "#2563eb", "#db2777", "#ea580c", "#7c3aed", "#0891b2", "#1f2937"];

const CreateStatusModal = () => {
  const { showCreate, setShowCreate, createStatus } = useStatusStore();
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [bg, setBg] = useState(COLORS[0]);
  const [image, setImage] = useState(null);

  if (!showCreate) return null;

  const onImage = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onloadend = () => setImage(r.result);
    r.readAsDataURL(f);
  };

  const close = () => {
    setShowCreate(false);
    setText("");
    setImage(null);
  };

  const submit = () => {
    if (tab === "text") {
      if (!text.trim()) return;
      createStatus({ type: "text", text: text.trim(), bgColor: bg });
    } else {
      if (!image) return;
      createStatus({ type: "image", image });
    }
    setText("");
    setImage(null);
  };

  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-black/50" onClick={close}>
      <div className="bg-base-100 rounded-xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h3 className="font-medium">Add to status</h3>
          <button onClick={close}>
            <X className="size-5" />
          </button>
        </div>

        <div className="flex border-b border-base-300">
          <button
            className={`flex-1 py-2 text-sm flex items-center justify-center gap-1 ${tab === "text" ? "border-b-2 border-primary text-primary" : "opacity-60"}`}
            onClick={() => setTab("text")}
          >
            <Type className="size-4" /> Text
          </button>
          <button
            className={`flex-1 py-2 text-sm flex items-center justify-center gap-1 ${tab === "image" ? "border-b-2 border-primary text-primary" : "opacity-60"}`}
            onClick={() => setTab("image")}
          >
            <ImageIcon className="size-4" /> Photo
          </button>
        </div>

        <div className="p-4 space-y-3">
          {tab === "text" ? (
            <>
              <div
                className="rounded-xl h-40 grid place-items-center p-4 text-white text-center"
                style={{ background: bg }}
              >
                <textarea
                  className="bg-transparent outline-none text-center w-full resize-none placeholder-white/60"
                  placeholder="Type a status…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="flex gap-2 justify-center">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBg(c)}
                    className={`size-6 rounded-full ${bg === c ? "ring-2 ring-offset-2 ring-base-content" : ""}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {image ? (
                <img src={image} alt="" className="rounded-xl max-h-48 mx-auto" />
              ) : (
                <label className="rounded-xl h-40 border-2 border-dashed border-base-300 grid place-items-center cursor-pointer">
                  <span className="opacity-60 text-sm">Choose a photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onImage} />
                </label>
              )}
            </div>
          )}
          <button
            onClick={submit}
            disabled={tab === "text" ? !text.trim() : !image}
            className="btn btn-primary btn-sm w-full"
          >
            Post status
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateStatusModal;
