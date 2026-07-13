import { MessageSquare, GitBranch, BookOpen, CircleDot, Activity } from "lucide-react";

// The Dev Workspace sections (Phase 2). Discussions reuses the existing chat; the four
// modules are placeholders now and gain real content in later phases. This module is the
// metadata source of truth + pure helpers; the section id → component wiring lives in
// DevWorkspace (next step). Kept dependency-light so it's unit-testable in isolation.
//
//   kind: "chat"   → rendered via the existing <ChatContainer/> (Discussions)
//   kind: "module" → an expandable module; `phase` notes when its backend lands
export const DEFAULT_SECTION_ID = "discussions";

export const SECTIONS = [
  { id: "discussions", label: "Discussions", icon: MessageSquare, kind: "chat" },
  { id: "repositories", label: "Repositories", icon: GitBranch, kind: "module", phase: 6 },
  { id: "documentation", label: "Documentation", icon: BookOpen, kind: "module", phase: 5 },
  { id: "issues", label: "Issues", icon: CircleDot, kind: "module", phase: 6 },
  { id: "activity", label: "Activity", icon: Activity, kind: "module", phase: 8 },
];

const BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

export const isValidSection = (id) => BY_ID.has(id);

// resolve a possibly missing/unknown section id to a valid one (defaults to Discussions)
export const resolveSectionId = (id) => (id && BY_ID.has(id) ? id : DEFAULT_SECTION_ID);

export const getSection = (id) => BY_ID.get(resolveSectionId(id));
