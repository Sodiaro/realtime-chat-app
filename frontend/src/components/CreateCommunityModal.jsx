import { useState } from "react";
import { useCommunityStore } from "../store/useCommunityStore";
import Modal from "./ui/Modal";
import Input from "./ui/Input";

const CreateCommunityModal = ({ onClose, onCreated }) => {
  const { createCommunity } = useCommunityStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const community = await createCommunity(name.trim(), description.trim());
    setBusy(false);
    if (community) {
      onCreated?.(community._id);
      onClose();
    }
  };

  return (
    <Modal
      title="New community"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={submit} disabled={!name.trim() || busy} className="btn btn-primary btn-sm">
            Create
          </button>
        </>
      }
    >
      <p className="text-sm text-base-content/60 mb-3">
        A community groups multiple chats together with a shared announcement channel.
      </p>
      <Input
        autoFocus
        size="sm"
        placeholder="Community name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3"
      />
      <textarea
        className="textarea textarea-bordered w-full"
        rows={2}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </Modal>
  );
};

export default CreateCommunityModal;
