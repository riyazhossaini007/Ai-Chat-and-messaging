import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import type { AiMessage } from "./AItypes";
import MessageActionMenu from "../chatComponents/MessageActionMenu";
import type { MessageAction } from "../chatComponents/MessageActionMenu";
import { hoverRevealVariant, optimizedMotionStyle } from "../../lib/motionVariants";

type AiMessageActionsProps = {
  message: AiMessage;
  children: ReactNode;
  open?: boolean;
  onRequestOpen?: (messageId: string) => void;
  onRequestClose?: () => void;
  onShare?: (messageId: string) => void;
  onCopy?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
};

export default function AiMessageActions({
  message,
  children,
  open = false,
  onRequestOpen,
  onRequestClose,
  onShare,
  onCopy,
  onRegenerate,
}: AiMessageActionsProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const repositionRafRef = useRef<number | null>(null);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [align, setAlign] = useState<"left" | "right" | "center">("left");
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>(undefined);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const isUser = message.role === "user";
  const isPaywallMessage = message.role === "ai" && message.kind === "paywall";
  const canShowMenu = !isPaywallMessage;

  const actionList = useMemo<MessageAction[]>(() => {
    if (!canShowMenu) return [];

    const actions: MessageAction[] = [
      {
        id: "share",
        label: "Share",
        onSelect: () => onShare?.(message.id),
      },
      {
        id: "copy",
        label: "Copy",
        onSelect: () => onCopy?.(message.id, message.content),
      },
    ];
    if (message.role === "ai" && message.kind !== "paywall" && onRegenerate) {
      actions.unshift({
        id: "regenerate",
        label: "Regenerate",
        onSelect: () => onRegenerate(message.id),
      });
    }
    return actions;
  }, [canShowMenu, message.content, message.id, message.kind, message.role, onCopy, onRegenerate, onShare]);

  const closeMenu = () => onRequestClose?.();

  const updateMenuPosition = () => {
    const bubbleEl = iconRef.current;
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

    let left = isUser ? bubbleRect.right - menuRect.width : bubbleRect.left;
    let nextAlign: "left" | "right" | "center" = isUser ? "right" : "left";

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
  }, [open, isUser]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleReposition, { passive: true });
    window.addEventListener("scroll", handleReposition, { capture: true, passive: true });
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("keydown", handleEscape);
      if (repositionRafRef.current !== null) {
        window.cancelAnimationFrame(repositionRafRef.current);
        repositionRafRef.current = null;
      }
    };
  }, [open]);

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (!canShowMenu) return;
    if (event.pointerType !== "touch") return;
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      onRequestOpen?.(message.id);
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

  const handleActionSelect = (action: MessageAction) => () => {
    action.onSelect();
    closeMenu();
  };

  const actionsWithClose = actionList.map((action) => ({
    ...action,
    onSelect: handleActionSelect(action),
  }));

  return (
    <div
      ref={wrapperRef}
      className="relative inline-block max-w-full"
      onMouseEnter={() => setShowQuickAction(true)}
      onMouseLeave={() => setShowQuickAction(false)}
      onFocusCapture={() => setShowQuickAction(true)}
      onBlurCapture={() => setShowQuickAction(false)}
    >
      {canShowMenu && (
        <motion.button
          ref={iconRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            if (open) {
              closeMenu();
              return;
            }
            onRequestOpen?.(message.id);
          }}
          variants={hoverRevealVariant}
          initial="initial"
          animate={showQuickAction || open ? "hover" : "initial"}
          style={optimizedMotionStyle}
          className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-zinc-200 ${
            isUser ? "-left-8" : "-right-8"
          }`}
        >
          <ChevronDown size={14} />
        </motion.button>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
      >
        {children}
      </div>

      {canShowMenu && (
        <MessageActionMenu
          ref={menuRef}
          open={open}
          actions={actionsWithClose}
          placement={placement}
          align={align}
          style={menuStyle}
        />
      )}
    </div>
  );
}
