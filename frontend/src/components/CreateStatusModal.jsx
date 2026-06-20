import { useState } from "react";
import { Type, Image as ImageIcon } from "lucide-react";
import { useStatusStore } from "../store/useStatusStore";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

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

  const tabBtn = (key, Icon, label) => (
    <button
      className={`flex-1 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors ${
        tab === key ? "border-b-2 border-primary text-primary font-medium" : "opacity-60 hover:opacity-100"
      }`}
      onClick={() => setTab(key)}
    >
      <Icon className="size-4" /> {label}
    </button>
  );

  return (
    <Modal
      title="Add to status"
      onClose={close}
      size="sm"
      footer={
        <Button
          onClick={submit}
          disabled={tab === "text" ? !text.trim() : !image}
          size="sm"
          className="w-full"
        >
          Post status
        </Button>
      }
    >
      <div className="-mt-1 -mx-5 mb-4 flex border-b border-base-300">
        {tabBtn("text", Type, "Text")}
        {tabBtn("image", ImageIcon, "Photo")}
      </div>

      {tab === "text" ? (
        <div className="space-y-3">
          <div
            className="rounded-xl h-44 grid place-items-center p-4 text-white text-center"
            style={{ background: bg }}
          >
            <textarea
              className="bg-transparent outline-none text-center w-full resize-none placeholder-white/60 text-lg font-medium"
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
                aria-label={`Background ${c}`}
                className={`size-6 rounded-full transition-transform hover:scale-110 ${
                  bg === c ? "ring-2 ring-offset-2 ring-offset-base-100 ring-base-content" : ""
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      ) : image ? (
        <img src={image} alt="" className="rounded-xl max-h-52 mx-auto" />
      ) : (
        <label className="rounded-xl h-44 border-2 border-dashed border-base-300 grid place-items-center cursor-pointer hover:bg-base-200/50 transition-colors">
          <span className="opacity-60 text-sm">Choose a photo</span>
          <input type="file" accept="image/*" className="hidden" onChange={onImage} />
        </label>
      )}
    </Modal>
  );
};

export default CreateStatusModal;
