import { CircleDot, CheckCircle2 } from "lucide-react";
import SectionEmptyState from "../SectionEmptyState";

const MOCK_ISSUES = [
  { open: true, title: "Flaky socket reconnect on mobile", id: 42, meta: "3 comments" },
  { open: true, title: "Add rate limit to invite creation", id: 41, meta: "bug · priority" },
  { open: false, title: "Dark mode contrast on badges", id: 38, meta: "done" },
];

const IssuesSection = ({ conversation }) => (
  <SectionEmptyState
    conversation={conversation}
    icon={CircleDot}
    title="Issues"
    description="Open, assign and triage engineering issues for this workspace, linked to the discussions that spawned them."
    cta="New issue"
    phase={6}
  >
    <div className="space-y-1">
      {MOCK_ISSUES.map((i) => (
        <div key={i.id} className="rounded-lg border border-base-300 p-3 flex items-center gap-3">
          {i.open ? (
            <CircleDot className="size-4 text-success shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 text-base-content/30 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{i.title}</div>
            <div className="text-xs text-base-content/50">
              #{i.id} · {i.meta}
            </div>
          </div>
          <span className={`badge badge-sm shrink-0 ${i.open ? "badge-success badge-outline" : "badge-ghost"}`}>
            {i.open ? "open" : "closed"}
          </span>
        </div>
      ))}
    </div>
  </SectionEmptyState>
);

export default IssuesSection;
