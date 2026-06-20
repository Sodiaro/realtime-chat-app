import { MessageSquare, Lock, Zap, Users } from "lucide-react";

const FEATURES = [
  { icon: Lock, label: "Private & secure" },
  { icon: Zap, label: "Realtime delivery" },
  { icon: Users, label: "Groups & calls" },
];

const NoChatSelected = () => {
  return (
    <div className="w-full flex flex-1 flex-col items-center justify-center p-8 sm:p-16 bg-base-100/40">
      <div className="max-w-sm text-center space-y-5">
        <div className="flex justify-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
            <MessageSquare className="size-8 text-primary" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight">Welcome to DevChat</h2>
          <p className="text-sm text-base-content/60">
            Select a conversation from the sidebar, or search for someone to start a new chat.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-1.5 text-xs text-base-content/60 bg-base-200/70 rounded-full px-3 py-1.5"
            >
              <f.icon className="size-3.5 text-primary" />
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NoChatSelected;
