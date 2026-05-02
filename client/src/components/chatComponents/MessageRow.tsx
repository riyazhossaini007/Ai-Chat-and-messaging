import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import MessageActionsMenu from "./MessageActionsMenu";
import MessageBubble from "./MessageBubble";
import type { Message } from "./types";
import { hoverRevealVariant, optimizedMotionStyle } from "../../lib/motionVariants";

type MessageRowProps = {
  message: Message;
  autoDownloadMedia?: boolean;
  menuOpen: boolean;
  onRequestMenuOpen: (messageId: string) => void;
  onRequestMenuClose: () => void;
  onOpenMedia: (payload: {
    type: "IMAGE" | "VIDEO";
    url: string;
    caption?: string;
    messageId: string;
  }) => void;
  onCopyMessage?: (messageId: string, text: string) => void;
  onReplyMessage?: (messageId: string) => void;
  onAskAiMessage?: (messageId: string) => void;
  onShareMessage?: (messageId: string) => void;
  onForwardMessage?: (messageId: string) => void;
  onStarMessage?: (messageId: string) => void;
  onSaveToMemory?: (messageId: string) => void;
  onSaveToKnowledge?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onInfoMessage?: (messageId: string) => void;
  onReactMessage?: (messageId: string, emoji: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onSelectionTrigger?: (messageId: string) => boolean | void;
};

export default function MessageRow({
  message,
  autoDownloadMedia = true,
  menuOpen,
  onRequestMenuOpen,
  onRequestMenuClose,
  onOpenMedia,
  onCopyMessage,
  onReplyMessage,
  onAskAiMessage,
  onShareMessage,
  onForwardMessage,
  onStarMessage,
  onSaveToMemory,
  onSaveToKnowledge,
  onDeleteMessage,
  onInfoMessage,
  onReactMessage,
  onToggleReaction,
  onSelectionTrigger,
}: MessageRowProps) {
  const isMine = message.sender === "me";
  const [showQuickAction, setShowQuickAction] = useState(false);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div
      className={`group flex ${isMine ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setShowQuickAction(true)}
      onMouseLeave={() => setShowQuickAction(false)}
      onFocusCapture={() => setShowQuickAction(true)}
      onBlurCapture={() => setShowQuickAction(false)}
    >
      <div className="relative max-w-[70%]">
        <motion.button
          ref={iconRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            if (menuOpen) {
              onRequestMenuClose();
              return;
            }
            onRequestMenuOpen(message.id);
          }}
          variants={hoverRevealVariant}
          initial="initial"
          animate={showQuickAction || menuOpen ? "hover" : "initial"}
          style={optimizedMotionStyle}
          className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-zinc-200 ${
            isMine ? "-left-8" : "-right-8"
          }`}
        >
          <ChevronDown size={14} />
        </motion.button>

        <div
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            clearLongPress();
            longPressTimerRef.current = window.setTimeout(() => {
              const handled = onSelectionTrigger?.(message.id);
              if (handled) return;
              onRequestMenuOpen(message.id);
            }, 420);
          }}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
        >
          <MessageBubble
            message={message}
            onToggleReaction={onToggleReaction}
            autoDownloadMedia={autoDownloadMedia}
            onOpenMedia={onOpenMedia}
          />
        </div>
      </div>

      <MessageActionsMenu
        open={menuOpen}
        onClose={onRequestMenuClose}
        message={message}
        isMine={isMine}
        anchorRef={iconRef}
        onCopy={onCopyMessage}
        onReply={onReplyMessage}
        onAskAi={onAskAiMessage}
        onShare={onShareMessage}
        onForward={onForwardMessage}
        onStar={onStarMessage}
        onSaveToMemory={onSaveToMemory}
        onSaveToKnowledge={onSaveToKnowledge}
        onReact={onReactMessage}
        onDeleteForMe={onDeleteMessage}
        onDeleteForEveryone={onDeleteMessage}
        onDownload={() => {
          if (!message.mediaUrl) return;
          const link = document.createElement("a");
          link.href = message.mediaUrl;
          link.download = `message-${message.id}`;
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
        onInfo={onInfoMessage}
      />
    </div>
  );
}
