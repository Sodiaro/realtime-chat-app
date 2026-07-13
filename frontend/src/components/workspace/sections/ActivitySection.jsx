import { Activity, MessageSquare } from "lucide-react";
import SectionEmptyState from "../SectionEmptyState";

// Dev.to-style feed (cards with author, title, #tag pills, reactions, comments, reading
// time, and Relevant/Latest/Top filters). Static mock for now — the live workspace feed
// arrives in Phase 8. Rendered inside the non-interactive preview scaffold.
const FEED = [
  {
    author: "Alice Chen", initial: "A", color: "bg-primary/20 text-primary", time: "2h ago",
    title: "Scaling Socket.IO with the Redis adapter",
    tags: ["architecture", "redis", "realtime"], reactions: 24, comments: 5, read: "6 min read",
  },
  {
    author: "Bob Ray", initial: "B", color: "bg-secondary/20 text-secondary", time: "5h ago",
    title: "Opened PR #42 — fix socket reconnect on mobile",
    tags: ["frontend", "bug"], reactions: 8, comments: 3, read: "2 min read",
  },
  {
    author: "Carol Diaz", initial: "C", color: "bg-accent/20 text-accent", time: "1d ago",
    title: "TIL: debugging WebRTC renegotiation mid-call",
    tags: ["webrtc", "til"], reactions: 12, comments: 1, read: "3 min read",
  },
  {
    author: "Dan Ostrov", initial: "D", color: "bg-info/20 text-info", time: "1d ago",
    title: "Why we moved presence tracking to Redis",
    tags: ["infra", "scaling"], reactions: 31, comments: 8, read: "7 min read",
  },
];

const ActivitySection = ({ conversation }) => (
  <SectionEmptyState
    conversation={conversation}
    icon={Activity}
    title="Activity"
    description="A Dev.to-style feed of commits, deployments, write-ups and decisions across this workspace."
    phase={8}
  >
    {/* feed filters (Relevant / Latest / Top) */}
    <div className="flex items-center gap-4 px-1 pb-3 text-sm">
      <span className="font-semibold text-base-content">Relevant</span>
      <span className="text-base-content/50">Latest</span>
      <span className="text-base-content/50">Top</span>
    </div>

    <div className="space-y-3">
      {FEED.map((item) => (
        <article key={item.title} className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-2">
          {/* author row */}
          <div className="flex items-center gap-2">
            <div className={`size-7 rounded-full grid place-items-center text-xs font-semibold ${item.color}`}>
              {item.initial}
            </div>
            <span className="text-sm font-medium">{item.author}</span>
            <span className="text-xs text-base-content/40">· {item.time}</span>
          </div>

          {/* title */}
          <h3 className="text-base sm:text-lg font-bold leading-snug">{item.title}</h3>

          {/* tag pills */}
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span key={t} className="text-xs text-base-content/55 rounded px-1.5 py-0.5 border border-base-300">
                #{t}
              </span>
            ))}
          </div>

          {/* reactions + comments + reading time */}
          <div className="flex items-center gap-4 text-xs text-base-content/50 pt-0.5">
            <span>
              <span aria-hidden="true">❤️ 🦄 🔥</span>{" "}
              <span className="font-medium text-base-content/70">{item.reactions}</span> reactions
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3.5" /> {item.comments}
            </span>
            <span className="ml-auto">{item.read}</span>
          </div>
        </article>
      ))}
    </div>
  </SectionEmptyState>
);

export default ActivitySection;
