import { useState } from "react";
import { X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl w-80 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h3 className="font-medium">New Group</h3>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="p-3 space-y-3 overflow-y-auto">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="space-y-1">
            {users.map((u) => (
              <label key={u._id} className="flex items-center gap-2 p-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selected.includes(u._id)}
                  onChange={() => toggle(u._id)}
                />
                <img src={u.profilePic || "/avatar.png"} className="size-7 rounded-full" alt="" />
                <span className="text-sm truncate">{u.fullName}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-base-300">
          <button
            onClick={submit}
            disabled={!name.trim() || selected.length === 0}
            className="btn btn-primary btn-sm w-full"
          >
            Create ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
