import { GitBranch } from "lucide-react";
import SectionEmptyState from "../SectionEmptyState";

const MOCK_REPOS = [
  { name: "devchat-backend", branch: "main", lang: "TypeScript", meta: "3 open PRs", when: "2h ago" },
  { name: "devchat-frontend", branch: "main", lang: "JavaScript", meta: "1 open PR", when: "1d ago" },
  { name: "devchat-infra", branch: "main", lang: "HCL", meta: "0 open PRs", when: "5d ago" },
];

const RepositoriesSection = ({ conversation }) => (
  <SectionEmptyState
    conversation={conversation}
    icon={GitBranch}
    title="Repositories"
    description="Link GitHub repositories to this workspace to track commits, branches and pull requests alongside the conversation."
    cta="Connect a repository"
    phase={6}
  >
    <div className="space-y-2">
      {MOCK_REPOS.map((r) => (
        <div key={r.name} className="rounded-xl border border-base-300 p-3 flex items-center gap-3">
          <GitBranch className="size-5 text-base-content/40 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{r.name}</div>
            <div className="text-xs text-base-content/50 truncate">
              {r.branch} · {r.lang} · {r.meta}
            </div>
          </div>
          <span className="text-xs text-base-content/40 shrink-0">{r.when}</span>
        </div>
      ))}
    </div>
  </SectionEmptyState>
);

export default RepositoriesSection;
