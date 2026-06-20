import { Phone, Clock, Star, UserRound } from "lucide-react";
import { usePanelStore } from "../store/usePanelStore";
import { useAuthStore } from "../store/useAuthStore";
import SlideOver from "./ui/SlideOver";
import CallsPanel from "./panels/CallsPanel";
import ScheduledPanel from "./panels/ScheduledPanel";
import StarredPanel from "./panels/StarredPanel";
import ContactsPanel from "./panels/ContactsPanel";

const CONFIG = {
  contacts: { title: "Contacts", icon: <UserRound className="size-5 text-primary" />, Comp: ContactsPanel },
  calls: { title: "Call history", icon: <Phone className="size-5 text-primary" />, Comp: CallsPanel },
  scheduled: { title: "Scheduled messages", icon: <Clock className="size-5 text-primary" />, Comp: ScheduledPanel },
  starred: { title: "Starred messages", icon: <Star className="size-5 text-primary" />, Comp: StarredPanel },
};

// renders the active slide-over panel (Contacts / Calls / Scheduled / Starred)
const PanelHost = () => {
  const { panel, closePanel } = usePanelStore();
  const { authUser } = useAuthStore();

  if (!authUser || !panel || !CONFIG[panel]) return null;
  const { title, icon, Comp } = CONFIG[panel];

  return (
    <SlideOver title={title} icon={icon} onClose={closePanel}>
      <Comp />
    </SlideOver>
  );
};

export default PanelHost;
