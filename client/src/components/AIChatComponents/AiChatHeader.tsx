import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Lock, Sparkles } from "lucide-react";

interface AiChatHeaderProps {
  modelSelection: string;
  modelTitle?: string;
  selectionGroups: Array<{
    provider: string;
    providerLabel: string;
    options: Array<{
      id: string;
      label: string;
      locked?: boolean;
      disabled?: boolean;
    }>;
  }>;
  onModelChange?: (selection: string) => void;
}

export default function AiChatHeader({
  modelSelection,
  modelTitle,
  selectionGroups,
  onModelChange,
}: AiChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const flatOptions = useMemo(
    () =>
      selectionGroups.flatMap((group) =>
        group.options.map((option) => ({
          ...option,
          provider: group.provider,
          providerLabel: group.providerLabel,
        }))
      ),
    [selectionGroups]
  );

  const activeOption = flatOptions.find((option) => option.id === modelSelection);
  const isLocked = Boolean(activeOption?.locked);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <div className="h-[68px] px-4 md:px-6 flex items-center justify-between text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500/25 to-teal-500/25 border border-cyan-400/30">
          <Sparkles size={16} className="text-cyan-200" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Euclit</span>
          <span className="font-semibold text-sm md:text-base">
            {modelTitle ?? activeOption?.label ?? modelSelection}
          </span>
        </div>
        {isLocked && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-100">
            <Lock size={10} />
            Paid
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
          <Bot size={12} />
          Ready
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/85 px-2.5 py-1.5 text-xs transition hover:border-cyan-400/40 hover:bg-slate-800/90"
          >
            <span className="max-w-[132px] truncate">{activeOption?.label ?? modelSelection}</span>
            <ChevronDown
              size={13}
              className={`text-slate-300 transition ${menuOpen ? "rotate-180" : "rotate-0"}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-[260] w-[280px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-cyan-400/20 bg-zinc-950/95 p-1.5 shadow-[0_24px_70px_-40px_rgba(6,182,212,0.85)] backdrop-blur-xl">
              <div className="max-h-[300px] overflow-y-auto pr-1">
                {selectionGroups.map((group) => (
                  <div key={group.provider} className="mb-2 last:mb-0">
                    <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                      {group.providerLabel}
                    </div>
                    <div className="space-y-1">
                      {group.options.map((entry) => {
                        const isSelected = entry.id === modelSelection;
                        const isDisabled = Boolean(entry.disabled);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              onModelChange?.(entry.id);
                              setMenuOpen(false);
                            }}
                            className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                              isSelected
                                ? "border-cyan-400/45 bg-cyan-400/12"
                                : "border-transparent bg-zinc-900/50 hover:border-cyan-400/25 hover:bg-zinc-900/75"
                            } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm text-zinc-100">{entry.label}</div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                                  {entry.locked ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/10 px-1.5 py-0.5 text-[10px] text-amber-100">
                                      <Lock size={10} />
                                      Paid
                                    </span>
                                  ) : (
                                    <span className="text-emerald-300">Free</span>
                                  )}
                                  {isDisabled && (
                                    <span className="rounded-full border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300">
                                      Cooldown
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isSelected && <Check size={15} className="shrink-0 text-cyan-300" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
