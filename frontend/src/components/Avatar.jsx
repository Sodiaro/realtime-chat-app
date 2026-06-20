import { useState } from "react";
import { UsersRound } from "lucide-react";

const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
];

// deterministic color from a seed string so a user always gets the same one
const colorFor = (seed) => {
  const s = String(seed || "?");
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return COLORS[sum % COLORS.length];
};

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";

// Profile/group image with graceful fallbacks: a colored initials avatar for
// users, a group icon for groups, and automatic fallback if the URL fails to load.
const Avatar = ({ user, name, src, size = "size-10", className = "", group = false }) => {
  const img = src ?? user?.profilePic;
  const label = name ?? user?.fullName ?? user?.name;
  const seed = user?._id || label || (group ? "group" : "?");
  // track which src failed, so changing the src auto-recovers (no effect needed)
  const [failedSrc, setFailedSrc] = useState(null);
  const broken = !!img && failedSrc === img;

  if (img && !broken) {
    return (
      <img
        src={img}
        alt={label || "avatar"}
        onError={() => setFailedSrc(img)}
        className={`${size} rounded-full object-cover bg-base-300 ${className}`}
      />
    );
  }

  if (group) {
    return (
      <div className={`${size} rounded-full grid place-items-center bg-primary/15 text-primary ${className}`}>
        <UsersRound className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <div
      className={`${size} rounded-full grid place-items-center text-white text-sm font-semibold ${colorFor(seed)} ${className}`}
    >
      {initials(label)}
    </div>
  );
};

export default Avatar;
