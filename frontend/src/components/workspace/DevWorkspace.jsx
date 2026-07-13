import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { resolveSectionId } from "./sectionRegistry.js";
import WorkspaceNav from "./WorkspaceNav";
import DiscussionsSection from "./sections/DiscussionsSection";
import RepositoriesSection from "./sections/RepositoriesSection";
import DocumentationSection from "./sections/DocumentationSection";
import IssuesSection from "./sections/IssuesSection";
import ActivitySection from "./sections/ActivitySection";

// id → component (kept out of sectionRegistry.js so that module stays pure/unit-testable)
const COMPONENTS = {
  discussions: DiscussionsSection,
  repositories: RepositoriesSection,
  documentation: DocumentationSection,
  issues: IssuesSection,
  activity: ActivitySection,
};

// The Dev Workspace shell: secondary nav + the active section. Rendered only for a group
// whose resolved mode is "dev" (gated in HomePage). Discussions renders the existing
// ChatContainer unchanged; the other sections are placeholder modules for now. Only the
// active section is mounted.
const DevWorkspace = ({ conversation }) => {
  // subscribe to the raw value so a section switch re-renders; default → Discussions
  const stored = useWorkspaceStore((s) => s.activeByWorkspace[conversation._id]);
  const setActiveSection = useWorkspaceStore((s) => s.setActiveSection);
  const activeId = resolveSectionId(stored);
  const ActiveSection = COMPONENTS[activeId] || DiscussionsSection;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <WorkspaceNav active={activeId} onSelect={(id) => setActiveSection(conversation._id, id)} />
      <div
        id="workspace-section-panel"
        role="tabpanel"
        aria-labelledby={`ws-tab-${activeId}`}
        className="flex-1 min-h-0 flex flex-col"
      >
        <ActiveSection conversation={conversation} />
      </div>
    </div>
  );
};

export default DevWorkspace;
