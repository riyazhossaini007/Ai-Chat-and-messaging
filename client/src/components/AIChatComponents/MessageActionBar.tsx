import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Check,
  Copy,
  Forward,
  Loader2,
  MoreHorizontal,
  Pin,
  RefreshCcw,
  Database,
  BookmarkPlus,
  Library,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

export type MessageActionBarProps = {
  messageId: string;
  isAi: boolean;
  isMine: boolean;
  canRegenerate?: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  onReact?: (type: "LIKE" | "DISLIKE") => void;
  onForwardInApp?: () => void;
  onForwardOutside?: () => void;
  onPin?: () => void;
  onSaveToMemory?: () => void;
  onSaveToKnowledge?: () => void;
  onViewSources?: () => void;
  reaction?: "LIKE" | "DISLIKE" | null;
  isRegenerating?: boolean;
  isDeleted?: boolean;
  copied?: boolean;
  isPinned?: boolean;
  hasSources?: boolean;
};

function ActionButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  buttonRef,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-zinc-300 transition ${
        active
          ? "border-cyan-400/45 bg-cyan-400/15 text-cyan-100"
          : "border-transparent bg-transparent hover:border-white/15 hover:bg-white/6 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {children}
    </button>
  );
}

export default function MessageActionBar({
  messageId,
  isAi,
  isMine,
  canRegenerate = false,
  onCopy,
  onRegenerate,
  onReact,
  onForwardInApp,
  onForwardOutside,
  onPin,
  onSaveToMemory,
  onSaveToKnowledge,
  onViewSources,
  reaction = null,
  isRegenerating = false,
  isDeleted = false,
  copied = false,
  isPinned = false,
  hasSources = false,
}: MessageActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(true);
  const [menuLeft, setMenuLeft] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const hasMoreActions = useMemo(
    () => Boolean(onForwardInApp || onForwardOutside || onPin || onSaveToMemory || onSaveToKnowledge || onViewSources),
    [onForwardInApp, onForwardOutside, onPin, onSaveToMemory, onSaveToKnowledge, onViewSources]
  );

  useEffect(() => {
    if (!moreOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      const triggerRect = moreButtonRef.current?.getBoundingClientRect();
      const menuHeight = moreMenuRef.current?.getBoundingClientRect().height ?? 96;
      const rootRect = rootRef.current?.getBoundingClientRect();
      if (!triggerRect) return;
      const gap = 8;
      const roomAbove = triggerRect.top;
      const roomBelow = window.innerHeight - triggerRect.bottom;
      const shouldOpenAbove = roomAbove >= menuHeight + gap || roomAbove >= roomBelow;
      setOpenAbove(shouldOpenAbove);
      if (rootRect) {
        setMenuLeft(triggerRect.left + triggerRect.width / 2 - rootRect.left);
      }
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [moreOpen]);

  if (!isAi) return null;

  const alignClass = isMine ? "justify-end" : "justify-start";

  return (
    <div
      ref={rootRef}
      data-message-action-bar={messageId}
      className={`relative z-20 mt-1 flex h-8 max-w-full items-center gap-1 overflow-visible ${alignClass}`}
    >
      <ActionButton
        label={copied ? "Copied" : "Copy"}
        onClick={onCopy}
        disabled={isDeleted}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </ActionButton>

      {!isDeleted && (
        <>
          <ActionButton
            label="Good response"
            onClick={onReact ? () => onReact("LIKE") : undefined}
            active={reaction === "LIKE"}
            disabled={!onReact}
          >
            <ThumbsUp size={14} />
          </ActionButton>
          <ActionButton
            label="Bad response"
            onClick={onReact ? () => onReact("DISLIKE") : undefined}
            active={reaction === "DISLIKE"}
            disabled={!onReact}
          >
            <ThumbsDown size={14} />
          </ActionButton>
        </>
      )}

      {!isDeleted && canRegenerate && onRegenerate && (
        <ActionButton label="Regenerate" onClick={onRegenerate} disabled={isRegenerating}>
          {isRegenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCcw size={14} />
          )}
        </ActionButton>
      )}

      {!isDeleted && hasMoreActions && (
        <>
          <ActionButton
            label="More actions"
            onClick={() => setMoreOpen((prev) => !prev)}
            active={moreOpen}
            buttonRef={moreButtonRef}
          >
            <MoreHorizontal size={14} />
          </ActionButton>

          {moreOpen && (
            <div
              ref={moreMenuRef}
              style={menuLeft !== null ? { left: `${menuLeft}px`, transform: "translateX(-50%)" } : undefined}
              className={`absolute z-[80] min-w-[148px] rounded-xl border border-white/12 bg-slate-950/95 p-1 shadow-xl backdrop-blur ${
                openAbove ? "bottom-9" : "top-9"
              }`}
            >
              {onForwardInApp && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onForwardInApp();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <Forward size={13} />
                  Forward in app
                </button>
              )}
              {onForwardOutside && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onForwardOutside();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <Forward size={13} />
                  Share outside
                </button>
              )}
              {onPin && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onPin();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <Pin size={13} />
                  {isPinned ? "Unpin" : "Pin"}
                </button>
              )}
              {onSaveToMemory && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSaveToMemory();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <BookmarkPlus size={13} />
                  Save to memory
                </button>
              )}
              {onSaveToKnowledge && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSaveToKnowledge();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <Library size={13} />
                  Save to knowledge
                </button>
              )}
              {onViewSources && hasSources && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onViewSources();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <Database size={13} />
                  View sources
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
