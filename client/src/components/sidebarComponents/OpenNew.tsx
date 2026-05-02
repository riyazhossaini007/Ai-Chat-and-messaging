import { SquarePen } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NewChatButtonProps {
  open: boolean;
  forceSidebarOpen: () => void;
}

export default function NewChatButton({
  open,
  forceSidebarOpen,
}: NewChatButtonProps) {
  const navigate = useNavigate();

  const handleNewChat = () => {
    forceSidebarOpen();
    navigate("/ai");
  };

  return (
    <button
      onClick={handleNewChat}
      className={`
        group w-full flex items-center gap-2
        px-3 py-2 rounded-xl
        bg-bg-elevated/40 border border-border-subtle/60
        hover:bg-bg-elevated/70 hover:border-border-subtle
        transition-all duration-200
        ${open ? "justify-start" : "justify-center"}
      `}
    >
      {/* Icon */}
      <div className="h-8 w-8 rounded-lg bg-primary-gradient flex items-center justify-center text-black shadow-glow-sm">
        <SquarePen size={16} />
      </div>

      {/* Animated Text */}
      <span
        className={`
          overflow-hidden whitespace-nowrap
          text-sm font-medium text-text-primary
          transition-all duration-300 ease-out 
          ${open
            ? "opacity-100 translate-x-0 max-w-[140px]"
            : "opacity-0 -translate-x-2 max-w-0"
          }
        `}
      >
        New Chat
      </span>

      {open && (
        <span className="ml-auto text-[11px] uppercase tracking-widest text-text-muted">
          Open
        </span>
      )}
    </button>
  );
}
