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
import type { MessageAction } from "./MessageActionMenu";

export type GroupMessageActionCallbacks = {
  onShare?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onCopy?: (messageId: string, content: string) => void;
  onForward?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
};

type GroupMessageActionsProps = GroupMessageActionCallbacks & {
  messageId: string;
  contentText: string;
  canDelete?: boolean;
  children: ReactNode;
};

export default function GroupMessageActions({
  messageId,
  contentText,
  canDelete,
  children,
  onReply,
  onShare,
  onCopy,
  onForward,
  onStar,
  onDelete,
  onReport,
}: GroupMessageActionsProps) {
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

  const actions = useMemo<MessageAction[]>(() => {
    const base: MessageAction[] = [
      { id: "reply", label: "Reply", onSelect: () => onReply?.(messageId) },
      {
        id: "copy",
        label: "Copy",
        onSelect: () => onCopy?.(messageId, contentText),
      },
      {
        id: "forward",
        label: "Forward",
        onSelect: () => onForward?.(messageId),
      },
      {
        id: "share",
        label: "Share",
        onSelect: () => (onShare ? onShare(messageId) : onReport?.(messageId)),
      },
      {
        id: "star",
        label: "Star",
        onSelect: () => onStar?.(messageId),
      },
    ];
    if (canDelete) {
      base.push({
        id: "delete",
        label: "Delete",
        tone: "danger",
        onSelect: () => onDelete?.(messageId),
      });
    }
    return base;
  }, [canDelete, contentText, messageId, onCopy, onDelete, onForward, onReply, onReport, onShare, onStar]);

  const closeMenu = () => setOpen(false);

  const updateMenuPosition = () => {
    const bubbleEl = bubbleRef.current;
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
    updateMenuPosition();
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

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType !== "touch") return;
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
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
    event.preventDefault();
    setOpen(true);
  };

  const actionsWithClose = actions.map((action) => ({
    ...action,
    onSelect: () => {
      action.onSelect();
      closeMenu();
    },
  }));

  return (
    <div ref={bubbleRef} className="relative" onContextMenu={handleContextMenu}>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
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
      />
    </div>
  );
}
