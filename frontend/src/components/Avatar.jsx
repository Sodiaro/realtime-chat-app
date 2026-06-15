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

// shows the profile pic, or a colored initials avatar when there's none
const Avatar = ({ user, name, src, size = "size-10", className = "" }) => {
  const img = src ?? user?.profilePic;
  const label = name ?? user?.fullName ?? user?.name;
  const seed = user?._id || label;

  if (img) {
    return (
      <img src={img} alt={label || "avatar"} className={`${size} rounded-full object-cover ${className}`} />
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
