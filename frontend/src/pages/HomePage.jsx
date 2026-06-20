import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import LeftRail from "../components/LeftRail";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import ChatInfoPanel from "../components/ChatInfoPanel";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    // mobile: under the top navbar. desktop: full height (navbar hidden, icon rail instead)
    <div className="h-[100dvh] pt-14 md:pt-0 bg-base-100">
      <div className="h-[calc(100dvh-3.5rem)] md:h-[100dvh] flex overflow-hidden">
        <LeftRail />

        {/* chat list — full width on mobile, fixed rail on tablet/desktop */}
        <div
          className={`${selectedUser ? "hidden md:flex" : "flex"} shrink-0 border-r border-base-300/60`}
        >
          <Sidebar />
        </div>

        {/* conversation — fills the remaining width */}
        <div className={`${selectedUser ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
          {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
        </div>

        {/* right info panel — wide screens only, when a chat is open */}
        {selectedUser && (
          <div className="hidden xl:flex w-80 shrink-0 border-l border-base-300/60">
            <ChatInfoPanel />
          </div>
        )}
      </div>
    </div>
  );
};
export default HomePage;
