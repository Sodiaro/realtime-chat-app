import { useEffect } from "react";
import { Plus } from "lucide-react";
import { useStatusStore } from "../store/useStatusStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";

const StatusBar = () => {
  const { groups, getStatuses, openViewer, setShowCreate } = useStatusStore();
  const { authUser } = useAuthStore();

  useEffect(() => {
    getStatuses();
  }, [getStatuses]);

  const myGroup = groups.find((g) => g.user?._id === authUser._id);
  const others = groups.filter((g) => g.user?._id !== authUser._id);

  return (
    <div className="flex gap-3 px-3 py-3 overflow-x-auto border-b border-base-300/50">
      <div
        className="flex flex-col items-center gap-1 shrink-0 w-16 cursor-pointer"
        onClick={() => (myGroup ? openViewer(myGroup) : setShowCreate(true))}
      >
        <div className="relative">
          <div className={`rounded-full p-0.5 ${myGroup?.hasUnviewed ? "ring-2 ring-primary" : ""}`}>
            <Avatar user={authUser} size="size-12" />
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              setShowCreate(true);
            }}
            className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-content rounded-full size-5 grid place-items-center ring-2 ring-base-100"
          >
            <Plus className="size-3.5" />
          </span>
        </div>
        <span className="text-xs truncate w-full text-center">My status</span>
      </div>

      {others.map((g) => (
        <button
          key={g.user._id}
          onClick={() => openViewer(g)}
          className="flex flex-col items-center gap-1 shrink-0 w-16"
        >
          <div className={`rounded-full p-0.5 ${g.hasUnviewed ? "ring-2 ring-primary" : "ring-2 ring-base-300"}`}>
            <Avatar user={g.user} size="size-12" />
          </div>
          <span className="text-xs truncate w-full text-center">{g.user.fullName?.split(" ")[0]}</span>
        </button>
      ))}
    </div>
  );
};

export default StatusBar;
