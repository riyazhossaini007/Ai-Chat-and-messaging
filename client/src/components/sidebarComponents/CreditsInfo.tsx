import { Gem } from "lucide-react";

interface CreditsInfoProps {
  open: boolean;
  credits: number;
  onBuyCredits: () => void;
}

export default function CreditsInfo({
  open,
  credits,
  onBuyCredits,
}: CreditsInfoProps) {
  return (
    <div className="border-t border-zinc-800 px-2 py-2">
      <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-r from-zinc-900/95 via-zinc-900/85 to-zinc-950/95 p-3 shadow-[0_18px_36px_-26px_rgba(6,182,212,0.7)]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10">
              <Gem size={15} className="text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Credits</p>
              <p className="truncate text-sm font-semibold text-zinc-100">{credits.toLocaleString()} available</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBuyCredits}
            className="shrink-0 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-200/70 hover:bg-cyan-400/20 hover:text-white"
          >
            Top up
          </button>
        </div>
        {open && (
          <p className="mt-2 text-[11px] text-zinc-400">
            Used for AI chat and image generation.
          </p>
        )}
        {!open && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onBuyCredits}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-cyan-300 hover:text-white"
            >
              Buy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
