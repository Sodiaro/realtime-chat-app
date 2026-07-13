import ChatContainer from "../../ChatContainer";

// Discussions reuses the existing chat verbatim — ChatContainer reads the selected
// conversation from the store, so there is nothing to adapt. This is the WhatsApp/Slack
// core of the Dev Workspace.
const DiscussionsSection = () => <ChatContainer />;

export default DiscussionsSection;
