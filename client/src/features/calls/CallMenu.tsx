import { useEffect, useRef, useState } from "react";
import { History, Phone, Settings, Video } from "lucide-react";
import { useCallStore } from "./callStore";

type CallMenuProps = {
  chatId?: string | null;
  peerUserId?: string | null;
  isGroup?: boolean;
};

export function CallMenu({ chatId, peerUserId, isGroup = false }: CallMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const startCall = useCallStore((state) => state.startCall);
  const openHistory = useCallStore((state) => state.openCallHistory);
  const openSettings = useCallStore((state) => state.openCallSettings);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const canStart = Boolean(chatId || peerUserId);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Open call menu"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white"
        onClick={() => setOpen((value) => !value)}
      >
        <Phone size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[120] w-52 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl">
          <button
            type="button"
            disabled={!canStart}
            onClick={() => {
              setOpen(false);
              void startCall({
                type: "VOICE",
                chatId: chatId ?? undefined,
                peerUserId: peerUserId ?? undefined,
                isGroup,
              });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            <Phone size={15} /> Voice Call
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={() => {
              setOpen(false);
              void startCall({
                type: "VIDEO",
                chatId: chatId ?? undefined,
                peerUserId: peerUserId ?? undefined,
                isGroup,
              });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            <Video size={15} /> Video Call
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openHistory();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
          >
            <History size={15} /> Call History
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openSettings();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
          >
            <Settings size={15} /> Call Settings
          </button>
        </div>
      )}
    </div>
  );
}
