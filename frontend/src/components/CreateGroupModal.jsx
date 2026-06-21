import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Avatar from "./Avatar";

const MAX_GROUP_MEMBERS = 200;

const CreateGroupModal = ({ onClose }) => {
  const { users, createGroup, setSelectedUser } = useChatStore();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);

  // the creator counts toward the cap, so members can be at most MAX - 1
  const atLimit = selected.length >= MAX_GROUP_MEMBERS - 1;
  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (!name.trim() || selected.length === 0) return;
    const group = await createGroup(name.trim(), selected);
    if (group) {
      setSelectedUser({ ...group, fullName: group.name });
      onClose();
    }
  };

  return (
    <Modal
      title="New group"
      onClose={onClose}
      size="sm"
      footer={
        <Button
          onClick={submit}
          disabled={!name.trim() || selected.length === 0}
          size="sm"
          className="w-full"
        >
          Create{selected.length ? ` (${selected.length})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {atLimit && (
          <p className="text-xs text-warning">Groups can have up to {MAX_GROUP_MEMBERS} members.</p>
        )}
        <div className="space-y-0.5">
          {users.map((u) => {
            const checked = selected.includes(u._id);
            return (
              <label
                key={u._id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 ${
                  !checked && atLimit ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={checked}
                  disabled={!checked && atLimit}
                  onChange={() => toggle(u._id)}
                />
                <Avatar user={u} size="size-8" />
                <span className="text-sm truncate">{u.fullName}</span>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
