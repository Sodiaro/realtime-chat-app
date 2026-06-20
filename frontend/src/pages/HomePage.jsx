import { useChatStore } from "../store/useChatStore";
import { useResizable } from "../hooks/useResizable";

import Sidebar from "../components/Sidebar";
import LeftRail from "../components/LeftRail";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import ChatInfoPanel from "../components/ChatInfoPanel";

// thin drag strip shown only on desktop
const ResizeHandle = ({ onPointerDown, side }) => (
  <div
    onPointerDown={onPointerDown}
    role="separator"
    aria-orientation="vertical"
    title="Drag to resize"
    className={`hidden md:block absolute top-0 ${
      side === "right" ? "right-0 -mr-0.5" : "left-0 -ml-0.5"
    } h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-20`}
  />
);

const HomePage = () => {
  const { selectedUser } = useChatStore();
  const [sidebarW, dragSidebar] = useResizable("devchat-sidebar-w", {
    initial: 340,
    min: 260,
    max: 480,
    edge: "right",
  });
  const [panelW, dragPanel] = useResizable("devchat-panel-w", {
    initial: 320,
    min: 260,
    max: 460,
    edge: "left",
  });

  return (
    // mobile: under the top navbar. desktop: full height (navbar hidden, icon rail instead)
    <div className="h-[100dvh] pt-14 md:pt-0 bg-base-100">
      <div className="h-[calc(100dvh-3.5rem)] md:h-[100dvh] flex overflow-hidden">
        <LeftRail />

        {/* chat list — full width on mobile, drag-resizable rail on desktop */}
        <div
          style={{ "--sw": `${sidebarW}px` }}
          className={`${selectedUser ? "hidden md:flex" : "flex"} shrink-0 w-full md:w-[var(--sw)] relative border-r border-base-300/60`}
        >
          <Sidebar />
          <ResizeHandle onPointerDown={dragSidebar} side="right" />
        </div>

        {/* conversation — fills the remaining width */}
        <div className={`${selectedUser ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
          {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
        </div>

        {/* right info panel — wide screens only, when a chat is open; resizable */}
        {selectedUser && (
          <div
            style={{ "--pw": `${panelW}px` }}
            className="hidden xl:flex shrink-0 w-[var(--pw)] relative border-l border-base-300/60"
          >
            <ResizeHandle onPointerDown={dragPanel} side="left" />
            <ChatInfoPanel />
          </div>
        )}
      </div>
    </div>
  );
};
export default HomePage;
