import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import ChatInfoPanel from "../components/ChatInfoPanel";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen bg-base-200/60">
      <div className="flex items-center justify-center pt-20 px-2 sm:px-4 pb-4">
        <div className="bg-base-100 rounded-3xl shadow-xl ring-1 ring-base-300/40 w-full max-w-7xl h-[calc(100vh-6rem)] overflow-hidden">
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
