import Modal from "./Modal";

// small confirmation dialog built on the shared Modal
const ConfirmModal = ({
  open = true,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  danger = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <button onClick={onClose} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm?.();
            onClose?.();
          }}
          className={`btn btn-sm ${danger ? "btn-error" : "btn-primary"}`}
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    {message && <p className="text-sm text-base-content/70">{message}</p>}
  </Modal>
);

export default ConfirmModal;
