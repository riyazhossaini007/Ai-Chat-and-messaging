import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Message } from "./types";
import MessageBubble from "./MessageBubble";
import MessageRow from "./MessageRow";
import MediaViewerModal from "./MediaViewerModal";
import DateSeparator from "../chat/DateSeparator";
import { getDateSeparatorLabel, getMessageDayKey } from "../chat/dateSeparatorUtils";
import { useChatAutoScroll } from "./useChatAutoScroll";
import {
  layoutTransition,
  messageReceiveVariant,
  messageSendVariant,
  optimizedMotionStyle,
} from "../../lib/motionVariants";

type ChatMessagesProps = {
  messages: Message[];
  selectionMode?: boolean;
  selectedMessageIds?: Record<string, true>;
  onToggleMessageSelection?: (messageId: string) => void;
  onShareMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onCopyMessage?: (messageId: string, text: string) => void;
  onReplyMessage?: (messageId: string) => void;
  onAskAiMessage?: (messageId: string) => void;
  onForwardMessage?: (messageId: string) => void;
  onStarMessage?: (messageId: string) => void;
  onSaveToMemory?: (messageId: string) => void;
  onSaveToKnowledge?: (messageId: string) => void;
  onReactMessage?: (messageId: string, emoji: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onSelectionTrigger?: (messageId: string) => boolean | void;
  autoDownloadMedia?: boolean;
};

export default function ChatMessages({
  messages,
  selectionMode = false,
  selectedMessageIds,
  onToggleMessageSelection,
  onShareMessage,
  onDeleteMessage,
  onCopyMessage,
  onReplyMessage,
  onAskAiMessage,
  onForwardMessage,
  onStarMessage,
  onSaveToMemory,
  onSaveToKnowledge,
  onReactMessage,
  onToggleReaction,
  onSelectionTrigger,
  autoDownloadMedia = true,
}: ChatMessagesProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const didInitialScrollRef = useRef(false);
  const previousMessageIdsRef = useRef<string[]>([]);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    type: "IMAGE" | "VIDEO";
    url: string;
    caption?: string;
    messageId: string;
  } | null>(null);

  const { isAtBottom, unseenCount, scrollToBottom, onNewMessage, onPrependMessages } =
    useChatAutoScroll({
      containerRef,
      deps: [messages],
      threshold: 80,
    });

  useEffect(() => {
    const currentIds = messages.map((message) => message.id);
    const previousIds = previousMessageIdsRef.current;

    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      scrollToBottom({ behavior: "auto" });
      animatedMessageIdsRef.current.clear();
      previousMessageIdsRef.current = currentIds;
      return;
    }

    if (previousIds.length > 0 && currentIds.length > previousIds.length) {
      const previousFirstId = previousIds[0];
      const previousLastId = previousIds[previousIds.length - 1];
      const indexOfPreviousFirst = currentIds.indexOf(previousFirstId);
      const prependOnly =
        indexOfPreviousFirst > 0 && currentIds[currentIds.length - 1] === previousLastId;

      if (prependOnly) {
        onPrependMessages();
        animatedMessageIdsRef.current.clear();
        previousMessageIdsRef.current = currentIds;
        return;
      }

      const appendOnly = previousIds.every((id, index) => currentIds[index] === id);
      if (appendOnly) {
        const addedMessages = messages.slice(previousIds.length);
        animatedMessageIdsRef.current = new Set(addedMessages.map((message) => message.id));
        addedMessages.forEach((message) => {
          if (message.sender === "me") {
            onNewMessage("outgoing");
            return;
          }
          if (message.kind === "SYSTEM") {
            onNewMessage("system");
            return;
          }
          onNewMessage("incoming");
        });
      } else {
        animatedMessageIdsRef.current.clear();
      }
    }

    previousMessageIdsRef.current = currentIds;
  }, [messages, onNewMessage, onPrependMessages, scrollToBottom]);

  useEffect(() => {
    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (viewer) {
        setViewer(null);
        return;
      }
      if (openMenuMessageId) {
        setOpenMenuMessageId(null);
      }
    };
    window.addEventListener("keydown", closeOnEsc);
    return () => {
      window.removeEventListener("keydown", closeOnEsc);
    };
  }, [openMenuMessageId, viewer]);

  const renderItems = useMemo(() => {
    const items: Array<
      | { kind: "separator"; key: string; label: string }
      | { kind: "message"; message: Message }
    > = [];

    let previousDayKey: string | null = null;
    messages.forEach((message) => {
      const currentDayKey = getMessageDayKey(message.createdAt);
      if (currentDayKey !== previousDayKey) {
        items.push({
          kind: "separator",
          key: `sep-${currentDayKey}`,
          label: getDateSeparatorLabel(message.createdAt),
        });
        previousDayKey = currentDayKey;
      }
      items.push({
        kind: "message",
        message,
      });
    });

    return items;
  }, [messages]);

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onLoadCapture={() => {
          if (isAtBottom) {
            scrollToBottom({ behavior: "auto" });
          }
        }}
        className="h-full space-y-3 overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-zinc-700"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {renderItems.map((item) => {
            if (item.kind === "separator") {
              return (
                <motion.div
                  key={item.key}
                  layout
                  transition={layoutTransition}
                  style={optimizedMotionStyle}
                >
                  <DateSeparator text={item.label} />
                </motion.div>
              );
            }

            const msg = item.message;
            const isMine = msg.sender === "me";
            const entryVariant = isMine ? messageSendVariant : messageReceiveVariant;
            const shouldAnimateEntry =
              !shouldReduceMotion && animatedMessageIdsRef.current.has(msg.id);

            if (msg.kind === "SYSTEM") {
              return (
                <motion.div
                  key={msg.id}
                  layout
                  transition={layoutTransition}
                  variants={entryVariant}
                  initial={shouldAnimateEntry ? "initial" : false}
                  animate={shouldAnimateEntry ? "animate" : undefined}
                  exit="exit"
                  style={optimizedMotionStyle}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[70%]">
                    <MessageBubble
                      message={msg}
                      autoDownloadMedia={autoDownloadMedia}
                      onToggleReaction={onToggleReaction}
                    />
                  </div>
                </motion.div>
              );
            }

            if (selectionMode) {
              const checked = Boolean(selectedMessageIds?.[msg.id]);
              const isMine = msg.sender === "me";
              return (
                <motion.div
                  key={msg.id}
                  layout
                  transition={layoutTransition}
                  variants={entryVariant}
                  initial={shouldAnimateEntry ? "initial" : false}
                  animate={shouldAnimateEntry ? "animate" : undefined}
                  exit="exit"
                  style={optimizedMotionStyle}
                  className={`flex items-center gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                >
                  {!isMine && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleMessageSelection?.(msg.id)}
                      className="h-4 w-4 accent-sky-500"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleMessageSelection?.(msg.id)}
                    className="max-w-[70%] min-w-0 text-left"
                  >
                    <MessageBubble
                      message={msg}
                      onToggleReaction={onToggleReaction}
                      autoDownloadMedia={autoDownloadMedia}
                    />
                  </button>
                  {isMine && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleMessageSelection?.(msg.id)}
                      className="h-4 w-4 accent-sky-500"
                    />
                  )}
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                layout
                transition={layoutTransition}
                variants={entryVariant}
                initial={shouldAnimateEntry ? "initial" : false}
                animate={shouldAnimateEntry ? "animate" : undefined}
                exit="exit"
                style={optimizedMotionStyle}
              >
                <MessageRow
                  message={msg}
                  autoDownloadMedia={autoDownloadMedia}
                  menuOpen={openMenuMessageId === msg.id}
                  onRequestMenuOpen={setOpenMenuMessageId}
                  onRequestMenuClose={() => setOpenMenuMessageId(null)}
                  onCopyMessage={onCopyMessage}
                  onReplyMessage={onReplyMessage}
                  onAskAiMessage={onAskAiMessage}
                  onShareMessage={onShareMessage}
                  onForwardMessage={onForwardMessage}
                  onStarMessage={onStarMessage}
                  onSaveToMemory={onSaveToMemory}
                  onSaveToKnowledge={onSaveToKnowledge}
                  onDeleteMessage={onDeleteMessage}
                  onOpenMedia={(payload) => {
                    setViewer(payload);
                    setOpenMenuMessageId(null);
                  }}
                  onReactMessage={onReactMessage}
                  onToggleReaction={onToggleReaction}
                  onSelectionTrigger={onSelectionTrigger}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!selectionMode && unseenCount > 0 && !isAtBottom && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => scrollToBottom({ behavior: "smooth" })}
            className="absolute bottom-4 right-4 z-20 rounded-full border border-cyan-300/35 bg-zinc-900/90 px-3 py-2 text-xs font-medium text-cyan-100 shadow-lg backdrop-blur"
          >
            New messages ({unseenCount})
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewer && (
          <MediaViewerModal
            type={viewer.type}
            url={viewer.url}
            caption={viewer.caption}
            layoutId={`media-${viewer.messageId}`}
            onClose={() => setViewer(null)}
            onDelete={() => {
              onDeleteMessage?.(viewer.messageId);
              setViewer(null);
            }}
            onForward={() => {
              onForwardMessage?.(viewer.messageId);
            }}
            onDownload={() => {
              const message = messages.find((item) => item.id === viewer.messageId);
              const mediaUrl = message?.mediaUrl ?? viewer.url;
              if (!mediaUrl) return;
              const link = document.createElement("a");
              link.href = mediaUrl;
              link.download = `media-${viewer.messageId}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
