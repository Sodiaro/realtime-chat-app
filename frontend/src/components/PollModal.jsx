import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

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
    <Modal
      title="Create poll"
      onClose={onClose}
      size="sm"
      footer={
        <Button onClick={submit} disabled={!valid} size="sm" className="w-full">
          Create poll
        </Button>
      }
    >
      <div className="space-y-3">
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Ask a question…"
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
              <button onClick={() => removeOpt(i)} className="btn btn-ghost btn-xs btn-circle text-error">
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
    </Modal>
  );
};

export default PollModal;
