import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const PollModal = ({ onClose }) => {
  const { sendMessage } = useChatStore();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOpt = () => options.length < 10 && setOptions((o) => [...o, ""]);
  const removeOpt = (i) => setOptions((o) => o.filter((_, j) => j !== i));

  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

  const submit = async () => {
    if (!valid) return;
    await sendMessage({
      poll: {
        question: question.trim(),
        options: options.map((o) => o.trim()).filter(Boolean),
        multiple,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose}>
      <div
        className="bg-base-100 rounded-xl w-80 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h3 className="font-medium">Create poll</h3>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => setOpt(i, e.target.value)}
              />
              {options.length > 2 && (
                <button onClick={() => removeOpt(i)} className="btn btn-ghost btn-xs btn-circle">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={addOpt} className="btn btn-ghost btn-sm gap-1">
              <Plus className="size-4" /> Add option
            </button>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={multiple}
              onChange={(e) => setMultiple(e.target.checked)}
            />
            Allow multiple answers
          </label>
        </div>
        <div className="p-3 border-t border-base-300">
          <button onClick={submit} disabled={!valid} className="btn btn-primary btn-sm w-full">
            Create poll
          </button>
        </div>
      </div>
    </div>
  );
};

export default PollModal;
