import { Search } from "lucide-react";
import { useRef } from "react";

interface SidebarSearchProps {
  open: boolean;
  onOpenSidebar: () => void;
  onSearch: (value: string) => void;
}

export default function SidebarSearch({
  open,
  onOpenSidebar,
  onSearch,
}: SidebarSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIconClick = () => {
    if (!open) {
      onOpenSidebar();
      setTimeout(() => inputRef.current?.focus(), 220);
    }
  };

  return (
    <div className=" mt-1">
      <div
        className={`
          relative flex items-center
          rounded-xl border border-zinc-800
          bg-zinc-900/60 backdrop-blur
          transition-all duration-300
          hover:border-indigo-500/40
          ${open ? "px-3 py-2" : "p-2 justify-center"}
        `}
      >
        {/* Icon (always centered when closed) */}
        <button
          onClick={handleIconClick}
          className={`
            flex items-center justify-center
            shrink-0
            text-zinc-400 hover:text-white
            transition
          `}
        >
          <Search size={18} />
        </button>

        {/* Animated input – removed from layout when closed */}
        <div
          className={`
            absolute left-10 right-3
            overflow-hidden
            transition-all duration-300 ease-out
            ${open
              ? "opacity-100 translate-x-0 pointer-events-auto"
              : "opacity-0 translate-x-2 pointer-events-none"
            }
          `}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search chats"
            onChange={(e) => onSearch(e.target.value)}
            className="
              w-full bg-transparent outline-none
              text-sm text-white
              placeholder-zinc-400
            "
          />
        </div>
      </div>
    </div>
  );
}
