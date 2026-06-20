import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import ChatInfoPanel from "../components/ChatInfoPanel";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-[100dvh] bg-base-200/40">
      <div className="md:flex md:items-center md:justify-center pt-14 md:pt-[4.5rem] px-0 md:px-4 pb-0 md:pb-4">
        {/* full-bleed on mobile, floating card on tablet/desktop */}
        <div className="bg-base-100 md:rounded-2xl shadow-none md:shadow-card md:ring-1 md:ring-base-300/50 w-full max-w-7xl h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-5.5rem)] overflow-hidden">
          <div className="flex h-full">
            {/* chat list — hidden on mobile when a chat is open */}
            <div className={`${selectedUser ? "hidden md:flex" : "flex"} shrink-0`}>
              <Sidebar />
            </div>

            {/* conversation */}
            <div className={`${selectedUser ? "flex" : "hidden md:flex"} flex-1 min-w-0 border-x border-base-300/50`}>
              {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
            </div>

            {/* right info panel — only on wide screens with a chat open */}
            {selectedUser && (
              <div className="hidden xl:flex w-80 shrink-0">
                <ChatInfoPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
