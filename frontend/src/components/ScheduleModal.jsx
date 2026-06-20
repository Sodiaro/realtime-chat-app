import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

// format a Date as the value a datetime-local input expects (local time)
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const plus = (mins) => new Date(Date.now() + mins * 60_000);
// `offsetDays` from today at `hour`; bumped a day if that moment already passed
const atDay = (offsetDays, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
};

const PRESETS = [
  { label: "In 1 hour", at: () => plus(60) },
  { label: "In 3 hours", at: () => plus(180) },
  { label: "Tonight 8 PM", at: () => atDay(0, 20) },
  { label: "Tomorrow 9 AM", at: () => atDay(1, 9) },
];

const ScheduleModal = ({ text, image, file, onClose, onScheduled }) => {
  const { scheduleMessage } = useChatStore();
  const [when, setWhen] = useState(toLocalInput(plus(60)));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const at = new Date(when);
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return;
    setSaving(true);
    const ok = await scheduleMessage({
      text,
      image,
      file,
      scheduledAt: at.toISOString(),
    });
    setSaving(false);
    if (ok) {
      onScheduled?.();
      onClose();
    }
  };

  return (
    <Modal
      title="Schedule message"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving}>
            {saving ? "Scheduling…" : "Schedule"}
          </Button>
        </>
      }
    >
      <p className="text-sm opacity-70 mb-3 line-clamp-2">
        {text?.trim() || (image ? "📷 Photo" : file ? `📎 ${file.name}` : "")}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setWhen(toLocalInput(p.at()))}
            className="btn btn-sm btn-outline"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="text-sm font-medium">Send at</label>
      <input
        type="datetime-local"
        value={when}
        min={toLocalInput(plus(1))}
        onChange={(e) => setWhen(e.target.value)}
        className="input input-bordered w-full mt-1"
      />
    </Modal>
  );
};

export default ScheduleModal;
