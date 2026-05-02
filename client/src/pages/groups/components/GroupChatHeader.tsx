import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { GroupDetailsRecord } from "../../../api/types";
import { CallMenu } from "../../../features/calls/CallMenu";

type GroupChatHeaderProps = {
  group: GroupDetailsRecord | null;
  roleLabel: string | null;
  onOpenInfoPanel: () => void;
  onLeaveGroup: () => void;
  canInteract?: boolean;
};

export default function GroupChatHeader({
  group,
  roleLabel,
  onOpenInfoPanel,
  onLeaveGroup,
  canInteract = true,
}: GroupChatHeaderProps) {
  const navigate = useNavigate();
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showHeaderMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuWrapRef.current?.contains(target)) return;
      setShowHeaderMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowHeaderMenu(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showHeaderMenu]);

  return (
    <div className="relative z-[90] overflow-visible border-b border-cyan-400/20 bg-gradient-to-r from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 px-4 py-3 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/groups")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white"
            aria-label="Back to groups"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="ml-1 h-9 w-9 overflow-hidden rounded-full border border-cyan-300/30 bg-gradient-to-br from-cyan-300/25 to-emerald-300/20">
            {group?.avatar ? (
              <img src={group.avatar} alt={group.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-cyan-100">
                {(group?.title ?? "Group").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">{group?.title ?? "Group"}</div>
            <button
              type="button"
              onClick={onOpenInfoPanel}
              className="text-xs text-zinc-300 hover:text-white"
            >
              {group?.memberCount ?? 0} members
            </button>
            {roleLabel && (
              <div className="mt-0.5 ml-2 inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                {roleLabel}
              </div>
            )}
          </div>
        </div>
        <div ref={menuWrapRef} className="relative flex items-center gap-2">
          {canInteract && (
            <>
              <CallMenu chatId={group?.chatId ?? undefined} isGroup />
              <button
                type="button"
                onClick={() => setShowHeaderMenu((value) => !value)}
                className="rounded-md border border-cyan-400/20 bg-zinc-900/70 p-1 text-zinc-200 hover:bg-white/10"
              >
                <MoreVertical size={16} />
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 top-8 z-[120] w-48 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInfoPanel();
                      setShowHeaderMenu(false);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
                  >
                    View group info
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLeaveGroup();
                      setShowHeaderMenu(false);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/10"
                  >
                    Leave group
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
