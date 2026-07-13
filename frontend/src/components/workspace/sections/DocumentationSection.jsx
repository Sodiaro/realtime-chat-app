import { BookOpen, FileText } from "lucide-react";
import SectionEmptyState from "../SectionEmptyState";

const MOCK_DOCS = [
  { name: "README.md", when: "edited 2d ago" },
  { name: "Architecture.md", when: "edited 5d ago" },
  { name: "API.md", when: "edited 1w ago" },
  { name: "Deployment.md", when: "edited 2w ago" },
];

const DocumentationSection = ({ conversation }) => (
  <SectionEmptyState
    conversation={conversation}
    icon={BookOpen}
    title="Documentation"
    description="Write and browse this workspace's README, architecture notes and API docs in one searchable place."
    cta="New document"
    phase={5}
  >
    <div className="space-y-1">
      {MOCK_DOCS.map((d) => (
        <div key={d.name} className="rounded-lg border border-base-300 p-3 flex items-center gap-3">
          <FileText className="size-4 text-base-content/40 shrink-0" />
          <span className="flex-1 truncate font-medium">{d.name}</span>
          <span className="text-xs text-base-content/40 shrink-0">{d.when}</span>
        </div>
      ))}
    </div>
  </SectionEmptyState>
);

export default DocumentationSection;
