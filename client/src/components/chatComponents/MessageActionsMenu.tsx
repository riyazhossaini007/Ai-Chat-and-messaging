import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Message } from "./types";

type MessageActionsMenuProps = {
  open: boolean;
  onClose: () => void;
  message: Message;
  isMine: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onCopy?: (messageId: string, text: string) => void;
  onReply?: (messageId: string) => void;
  onAskAi?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onSaveToMemory?: (messageId: string) => void;
  onSaveToKnowledge?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onDeleteForEveryone?: (messageId: string) => void;
  onDownload?: (messageId: string) => void;
  onInfo?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
};

type MenuAction = {
  id: string;
  label: string;
  tone?: "default" | "danger";
  onSelect: () => void;
};

const isAudioUrl = (message: Message) => {
  const url = message.mediaUrl ?? "";
  if (!url) return false;
  if (url.startsWith("data:audio/")) return true;
  if (/\.(mp3|wav|ogg|m4a|webm|aac|flac)$/i.test(url)) return true;
  return /voice message/i.test(message.text || "");
};

export default function MessageActionsMenu({
  open,
  onClose,
  message,
  isMine,
  anchorRef,
  onCopy,
  onReply,
  onAskAi,
  onShare,
  onForward,
  onStar,
  onSaveToMemory,
  onSaveToKnowledge,
  onReact,
  onDeleteForMe,
  onDeleteForEveryone,
  onDownload,
  onInfo,
  onRetry,
}: MessageActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);

  const isFailed = (message.status as string | undefined)?.toLowerCase() === "failed";
  const hasMedia = Boolean(message.mediaUrl);
  const isMedia =
    message.messageType === "IMAGE" || message.messageType === "VIDEO" || (message.messageType === "FILE" && hasMedia);
  const isText = !isMedia && !message.deletedForEveryone;
  const hasCaption = Boolean(message.text?.trim() && isMedia);
  const isAudio = message.messageType === "FILE" && isAudioUrl(message);

  const actions = useMemo<MenuAction[]>(() => {
    if (isFailed) {
      return [
        {
          id: "retry",
          label: "Retry",
          onSelect: () => onRetry?.(message.id),
        },
        {
          id: "delete",
          label: "Delete",
          tone: "danger",
          onSelect: () => onDeleteForMe?.(message.id),
        },
      ];
    }

    if (isText) {
      const textActions: MenuAction[] = [];
      if (message.text?.trim()) {
        textActions.push({
          id: "copy_text",
          label: "Copy text",
          onSelect: () => onCopy?.(message.id, message.text ?? ""),
        });
      }
      textActions.push(
        {
          id: "reply",
          label: "Reply",
          onSelect: () => onReply?.(message.id),
        },
        {
          id: "ask_ai",
          label: "Ask AI",
          onSelect: () => onAskAi?.(message.id),
        },
        {
          id: "share",
          label: "Share",
          onSelect: () => onShare?.(message.id),
        },
        {
          id: "forward",
          label: "Forward",
          onSelect: () => onForward?.(message.id),
        },
        {
          id: "star",
          label: "Star",
          onSelect: () => onStar?.(message.id),
        },
        {
          id: "delete",
          label: "Delete",
          tone: "danger",
          onSelect: () => onDeleteForMe?.(message.id),
        }
      );
      if (onSaveToMemory) {
        textActions.push({
          id: "save_memory",
          label: "Save to Memory",
          onSelect: () => onSaveToMemory(message.id),
        });
      }
      if (onSaveToKnowledge) {
        textActions.push({
          id: "save_knowledge",
          label: "Save to Knowledge",
          onSelect: () => onSaveToKnowledge(message.id),
        });
      }
      if (onInfo) {
        textActions.push({
          id: "info",
          label: "Info",
          onSelect: () => onInfo(message.id),
        });
      }
      return textActions;
    }

    const mediaActions: MenuAction[] = [
      {
        id: "reply",
        label: "Reply",
        onSelect: () => onReply?.(message.id),
      },
      {
        id: "ask_ai",
        label: "Ask AI",
        onSelect: () => onAskAi?.(message.id),
      },
      {
        id: "share",
        label: "Share",
        onSelect: () => onShare?.(message.id),
      },
      {
        id: "forward",
        label: "Forward",
        onSelect: () => onForward?.(message.id),
      },
      {
        id: "star",
        label: "Star",
        onSelect: () => onStar?.(message.id),
      },
      {
        id: "download",
        label: isAudio ? "Save audio" : "Save / Download",
        onSelect: () => onDownload?.(message.id),
      },
      {
        id: "delete",
        label: "Delete",
        tone: "danger",
        onSelect: () => onDeleteForMe?.(message.id),
      },
    ];
    if (onSaveToMemory) {
      mediaActions.push({
        id: "save_memory",
        label: "Save to Memory",
        onSelect: () => onSaveToMemory(message.id),
      });
    }
    if (onSaveToKnowledge) {
      mediaActions.push({
        id: "save_knowledge",
        label: "Save to Knowledge",
        onSelect: () => onSaveToKnowledge(message.id),
      });
    }
    if (hasCaption) {
      mediaActions.push({
        id: "copy_caption",
        label: "Copy caption",
        onSelect: () => onCopy?.(message.id, message.text ?? ""),
      });
    }
    if (onInfo) {
      mediaActions.push({
        id: "info",
        label: "Info",
        onSelect: () => onInfo(message.id),
      });
    }
    return mediaActions;
  }, [
    hasCaption,
    isAudio,
    isFailed,
    isMedia,
    isText,
    message.id,
    message.text,
    onCopy,
    onDeleteForEveryone,
    onDeleteForMe,
    onDownload,
    onForward,
    onInfo,
    onReply,
    onAskAi,
    onReact,
    onRetry,
    onSaveToKnowledge,
    onSaveToMemory,
    onShare,
    onStar,
  ]);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const downTop = anchorRect.bottom + gap;
    const upTop = anchorRect.top - menuRect.height - gap;
    const shouldOpenUp = downTop + menuRect.height > viewportHeight - gap && upTop >= gap;
    const top = shouldOpenUp
      ? upTop
      : Math.max(gap, Math.min(downTop, viewportHeight - menuRect.height - gap));

    const preferredLeft = isMine ? anchorRect.right - menuRect.width : anchorRect.left;
    const left = Math.max(gap, Math.min(preferredLeft, viewportWidth - menuRect.width - gap));

    setMenuStyle({ top: Math.round(top), left: Math.round(left) });
  }, [anchorRef, isMine, open, actions.length]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEsc);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEsc);
    };
  }, [anchorRef, onClose, open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
  }, [open, actions.length]);

  if (!open) return null;

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (actions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = (activeIndex + 1) % actions.length;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = (activeIndex - 1 + actions.length) % actions.length;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      actions[activeIndex]?.onSelect();
      onClose();
    }
  };

  const content = (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Message actions"
      onKeyDown={onMenuKeyDown}
      style={{
        top: menuStyle?.top ?? -9999,
        left: menuStyle?.left ?? -9999,
      }}
      className={`fixed z-[70] min-w-[210px] rounded-xl border border-zinc-700 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur ${
        menuStyle ? "opacity-100" : "opacity-0"
      }`}
    >
      {onReact && (
        <div className="mb-1 flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-black/25 p-1">
          {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(message.id, emoji);
                onClose();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-base hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {actions.map((action, index) => (
        <button
          key={action.id}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          type="button"
          role="menuitem"
          onFocus={() => setActiveIndex(index)}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
          className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none ${
            action.tone === "danger"
              ? "text-rose-300 hover:bg-rose-500/10 focus-visible:bg-rose-500/10"
              : "text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
