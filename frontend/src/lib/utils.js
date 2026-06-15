export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// "last seen" relative label, e.g. "just now", "5m ago", "3h ago", "2d ago"
export function formatLastSeen(date) {
  if (!date) return "Offline";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}