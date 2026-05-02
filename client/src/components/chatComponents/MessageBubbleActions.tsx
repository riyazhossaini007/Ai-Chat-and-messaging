import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import MessageActionMenu from "./MessageActionMenu";
import type { Message } from "./types";
import type { MessageAction, MessageActionId } from "./MessageActionMenu";

type MessageActionCallbacks = {
  onShare?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onCopyText?: (messageId: string, text: string) => void;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onSelectionTrigger?: (messageId: string) => boolean | void;
};

type MessageBubbleActionsProps = MessageActionCallbacks & {
  message: Message;
  children: ReactNode;
  actions?: MessageActionId[];
};

const DEFAULT_ACTIONS: MessageActionId[] = [
  "reply",
  "copy",
  "forward",
  "share",
  "star",
  "delete",
];

export default function MessageBubbleActions({
  message,
  children,
  actions = DEFAULT_ACTIONS,
  onShare,
  onDelete,
  onCopyText,
  onReply,
  onForward,
  onStar,
  onReact,
  onSelectionTrigger,
}: MessageBubbleActionsProps) {
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const repositionRafRef = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [align, setAlign] = useState<"left" | "right" | "center">("left");
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>(
    undefined
  );

  const actionList = useMemo<MessageAction[]>(() => {
    const actionMap: Record<MessageActionId, MessageAction> = {
      share: {
        id: "share",
        label: "Share",
        onSelect: () => onShare?.(message.id),
      },
      delete: {
        id: "delete",
        label: "Delete",
        tone: "danger",
        onSelect: () => onDelete?.(message.id),
      },
      copy: {
        id: "copy",
        label: "Copy",
        onSelect: () => onCopyText?.(message.id, message.text ?? ""),
      },
      reply: {
        id: "reply",
        label: "Reply",
        onSelect: () => onReply?.(message.id),
      },
      forward: {
        id: "forward",
        label: "Forward",
        onSelect: () => onForward?.(message.id),
      },
      star: {
        id: "star",
        label: "Star",
        onSelect: () => onStar?.(message.id),
      },
      regenerate: {
        id: "regenerate",
        label: "Regenerate",
        onSelect: () => undefined,
      },
    };

    return actions.map((id) => actionMap[id]);
  }, [
    actions,
    message.id,
    message.text,
    onCopyText,
    onDelete,
    onForward,
    onReply,
    onShare,
    onStar,
  ]);

  const closeMenu = () => setOpen(false);

  const updateMenuPosition = () => {
    const containerEl = bubbleRef.current;
    const bubbleEl =
      (containerEl?.querySelector?.("[data-message-bubble='true']") as HTMLElement | null) ??
      containerEl;
    const menuEl = menuRef.current;
    if (!bubbleEl || !menuEl) return;

    const bubbleRect = bubbleEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;

    let nextPlacement: "top" | "bottom" = "top";
    let top = bubbleRect.top - menuRect.height - gap;

    if (top < gap) {
      nextPlacement = "bottom";
      top = bubbleRect.bottom + gap;
    }

    if (top + menuRect.height > viewportHeight - gap) {
      nextPlacement = "top";
      top = Math.max(gap, bubbleRect.top - menuRect.height - gap);
    }

    let left = bubbleRect.left;
    let nextAlign: "left" | "right" | "center" = "left";

    if (left + menuRect.width > viewportWidth - gap) {
      left = bubbleRect.right - menuRect.width;
      nextAlign = "right";
    }

    if (left < gap) {
      left = gap;
      nextAlign = "left";
    }

    setPlacement(nextPlacement);
    setAlign(nextAlign);
    setMenuStyle({
      top: Math.round(top),
      left: Math.round(left),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    const rafId = window.requestAnimationFrame(() => {
      updateMenuPosition();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (bubbleRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };

    const handleReposition = () => {
      if (repositionRafRef.current !== null) return;
      repositionRafRef.current = window.requestAnimationFrame(() => {
        repositionRafRef.current = null;
        updateMenuPosition();
      });
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleReposition, { passive: true });
    window.addEventListener("scroll", handleReposition, { capture: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      if (repositionRafRef.current !== null) {
        window.cancelAnimationFrame(repositionRafRef.current);
        repositionRafRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType !== "touch") return;
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      const handled = onSelectionTrigger?.(message.id);
      if (handled) return;
      setOpen(true);
    }, 450);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => clearLongPress();
  const handlePointerLeave = () => clearLongPress();
  const handlePointerCancel = () => clearLongPress();
  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    const target = event.target as HTMLElement;
    if (!target.closest("[data-message-bubble='true']")) {
      return;
    }

    setOpen((prev) => !prev);
  };

  const handleContextMenu = (event: ReactMouseEvent) => {
    const handled = onSelectionTrigger?.(message.id);
    if (handled) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setOpen(true);
  };

  const handleActionSelect = (action: MessageAction) => () => {
    action.onSelect();
    closeMenu();
  };

  const actionsWithClose = actionList.map((action) => ({
    ...action,
    onSelect: handleActionSelect(action),
  }));

  return (
    <div ref={bubbleRef} className="relative" onContextMenu={handleContextMenu}>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
      >
        {children}
      </div>

      <MessageActionMenu
        ref={menuRef}
        open={open}
        actions={actionsWithClose}
        placement={placement}
        align={align}
        style={menuStyle}
        quickReactions={["👍", "❤️", "😂", "😮", "😢", "🙏"]}
        onReact={(emoji) => {
          onReact?.(message.id, emoji);
          closeMenu();
        }}
      />
    </div>
  );
}
