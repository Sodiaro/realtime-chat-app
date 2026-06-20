import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Avatar from "./Avatar";

const CreateGroupModal = ({ onClose }) => {
  const { users, createGroup, setSelectedUser } = useChatStore();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);

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
        <div className="space-y-0.5">
          {users.map((u) => (
            <label
              key={u._id}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-base-200"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selected.includes(u._id)}
                onChange={() => toggle(u._id)}
              />
              <Avatar user={u} size="size-8" />
              <span className="text-sm truncate">{u.fullName}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
