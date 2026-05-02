import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AiMessage, AiModel } from "./AItypes";
import AiMessageBubble from "./AiMessageBubble";
import AiImageBubble from "./AiImageBubble";
import MessageActionBar from "./MessageActionBar";
import { useChatAutoScroll } from "../chatComponents/useChatAutoScroll";
import clsx from "clsx";
import {
  layoutTransition,
  messageReceiveVariant,
  messageSendVariant,
  optimizedMotionStyle,
  typingDotVariant,
} from "../../lib/motionVariants";

const useIsCoarsePointer = () => {
  const [isCoarse, setIsCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarse(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => {
      query.removeEventListener?.("change", update);
    };
  }, []);

  return isCoarse;
};

interface Props {
  messages: AiMessage[];
  isGenerating?: boolean;
  quickPrompts?: string[];
  onPromptSelect?: (prompt: string) => void;
  onShareMessage?: (messageId: string, content: string) => void;
  onCopyMessage?: (messageId: string, content: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  onReactMessage?: (messageId: string, type: "LIKE" | "DISLIKE") => void;
  onForwardInAppMessage?: (messageId: string, content: string) => void;
  onForwardOutsideMessage?: (messageId: string, content: string) => void;
  onPinMessage?: (messageId: string) => void;
  onSaveToMemory?: (messageId: string) => void;
  onSaveToKnowledge?: (messageId: string) => void;
  onViewSources?: (messageId: string) => void;
  hasSources?: (messageId: string) => boolean;
  onDismissPaywallMessage?: (messageId: string) => void;
  onSelectSuggestedModel?: (model: AiModel) => void;
  onRetryCurrentModel?: () => void;
}

export default function AiMessages({
  messages,
  isGenerating = false,
  quickPrompts = [],
  onPromptSelect,
  onShareMessage,
  onCopyMessage,
  onRegenerateMessage,
  onReactMessage,
  onForwardInAppMessage,
  onForwardOutsideMessage,
  onPinMessage,
  onSaveToMemory,
  onSaveToKnowledge,
  onViewSources,
  hasSources,
  onDismissPaywallMessage,
  onSelectSuggestedModel,
  onRetryCurrentModel,
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const isCoarsePointer = useIsCoarsePointer();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const didInitialScrollRef = useRef(false);
  const previousMessageIdsRef = useRef<string[]>([]);
  const copiedIconTimerRef = useRef<number | null>(null);
  const copiedToastTimerRef = useRef<number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const { isAtBottom, unseenCount, scrollToBottom, onNewMessage } = useChatAutoScroll({
    containerRef,
    deps: [messages, isGenerating],
    threshold: 96,
  });

  useEffect(() => {
    return () => {
      if (copiedIconTimerRef.current) {
        window.clearTimeout(copiedIconTimerRef.current);
        copiedIconTimerRef.current = null;
      }
      if (copiedToastTimerRef.current) {
        window.clearTimeout(copiedToastTimerRef.current);
        copiedToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      setRegeneratingMessageId(null);
    }
  }, [isGenerating]);

  useEffect(() => {
    const currentIds = messages.map((message) => message.id);
    const previousIds = previousMessageIdsRef.current;

    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      scrollToBottom({ behavior: "auto" });
      previousMessageIdsRef.current = currentIds;
      return;
    }

    if (previousIds.length > 0 && currentIds.length > previousIds.length) {
      const appendOnly = previousIds.every((id, index) => currentIds[index] === id);
      if (appendOnly) {
        const addedMessages = messages.slice(previousIds.length);
        addedMessages.forEach((message) => {
          if (message.role === "user") {
            onNewMessage("outgoing");
            return;
          }
          onNewMessage("incoming");
        });
      }
    }

    previousMessageIdsRef.current = currentIds;
  }, [messages, onNewMessage, scrollToBottom]);

  useEffect(() => {
    if (!isGenerating || !isAtBottom) return;
    scrollToBottom({ behavior: "auto" });
  }, [isAtBottom, isGenerating, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 md:px-6 py-8">
        <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/45 backdrop-blur-xl p-6 md:p-8 shadow-[0_30px_80px_-45px_rgba(20,184,166,0.6)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Assistant</p>
          <h2 className="mt-2 text-2xl md:text-3xl font-semibold text-white">What should we build today?</h2>
          <p className="mt-2 text-sm text-slate-300">
            Ask for code, product strategy, debugging, or content. Your prompts stay in this AI session.
          </p>
          {quickPrompts.length > 0 && (
            <div className="mt-6 grid gap-2 md:grid-cols-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPromptSelect?.(prompt)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onLoadCapture={() => {
          if (isAtBottom) {
            scrollToBottom({ behavior: "auto" });
          }
        }}
        className="h-full space-y-3 overflow-y-auto px-3 pt-3 pb-24 scrollbar-thin scrollbar-thumb-zinc-700"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {messages.map((msg) => {
            const isEmptyAiPlaceholder =
              msg.role === "ai" &&
              msg.type === "text" &&
              msg.content.trim().length === 0;
            if (isEmptyAiPlaceholder) {
              return null;
            }
            const entryVariant = msg.role === "user" ? messageSendVariant : messageReceiveVariant;

            if (msg.kind === "paywall") {
              return (
                <motion.div
                  key={msg.id}
                  layout
                  transition={layoutTransition}
                  variants={entryVariant}
                  initial={shouldReduceMotion ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  style={optimizedMotionStyle}
                  className="mb-4 flex w-full justify-center"
                >
                  <div className="relative w-full max-w-xl rounded-2xl border border-cyan-300/30 bg-slate-950/90 p-5 text-center shadow-[0_22px_55px_-30px_rgba(34,211,238,0.7)]">
                    <button
                      type="button"
                      onClick={() => onDismissPaywallMessage?.(msg.id)}
                      className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/5 p-1 text-zinc-300 hover:bg-white/10 hover:text-white"
                      aria-label="Close paywall message"
                    >
                      <X size={14} />
                    </button>
                    <div className="text-sm font-semibold text-cyan-100">Credits required</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{msg.content}</div>
                    <div className="mt-4 flex justify-center">
                      <a
                        href="/credits"
                        className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/25"
                      >
                        Buy Credits
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            }

            const isAiMessage = msg.role === "ai";
            const isSystem = msg.role === "system";
            const actionVisibilityClass = isCoarsePointer ? "opacity-100" : "opacity-0";
            const canRegenerate =
              isAiMessage &&
              !isSystem &&
              !msg.isDeleted &&
              Boolean(msg.canRegenerate ?? true) &&
              Boolean(onRegenerateMessage);

            const bubble = msg.type === "image" ? (
              <AiImageBubble message={msg} />
            ) : (
              <AiMessageBubble
                message={msg}
                onSelectSuggestedModel={onSelectSuggestedModel}
                onRetryCurrentModel={onRetryCurrentModel}
              />
            );

            return (
              <motion.div
                key={msg.id}
                layout
                transition={layoutTransition}
                variants={entryVariant}
                initial={shouldReduceMotion ? false : "initial"}
                animate="animate"
                exit="exit"
                style={optimizedMotionStyle}
                className={clsx(
                  "group w-full flex mb-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div className="max-w-full">
                  {bubble}
                  {isAiMessage && !isSystem && (
                    <div
                      className={clsx(
                        "transition-opacity duration-150",
                        actionVisibilityClass,
                        !isCoarsePointer && "group-hover:opacity-100 group-focus-within:opacity-100"
                      )}
                    >
                      <MessageActionBar
                        messageId={msg.id}
                        isAi
                        isMine={false}
                        canRegenerate={canRegenerate}
                        onCopy={() => {
                          onCopyMessage?.(msg.id, msg.content);
                          setCopiedMessageId(msg.id);
                          setShowCopiedToast(true);
                          if (copiedIconTimerRef.current) {
                            window.clearTimeout(copiedIconTimerRef.current);
                          }
                          if (copiedToastTimerRef.current) {
                            window.clearTimeout(copiedToastTimerRef.current);
                          }
                          copiedIconTimerRef.current = window.setTimeout(() => {
                            setCopiedMessageId(null);
                            copiedIconTimerRef.current = null;
                          }, 900);
                          copiedToastTimerRef.current = window.setTimeout(() => {
                            setShowCopiedToast(false);
                            copiedToastTimerRef.current = null;
                          }, 1400);
                        }}
                        onRegenerate={
                          canRegenerate
                            ? () => {
                                setRegeneratingMessageId(msg.id);
                                onRegenerateMessage?.(msg.id);
                              }
                            : undefined
                        }
                        onReact={onReactMessage ? (type) => onReactMessage(msg.id, type) : undefined}
                        onForwardInApp={
                          onForwardInAppMessage
                            ? () => {
                                onForwardInAppMessage(msg.id, msg.content);
                              }
                            : undefined
                        }
                        onForwardOutside={
                          onForwardOutsideMessage
                            ? () => {
                                onForwardOutsideMessage(msg.id, msg.content);
                              }
                            : onShareMessage
                              ? () => {
                                  onShareMessage(msg.id, msg.content);
                                }
                              : undefined
                        }
                        onPin={onPinMessage ? () => onPinMessage(msg.id) : undefined}
                        onSaveToMemory={onSaveToMemory ? () => onSaveToMemory(msg.id) : undefined}
                        onSaveToKnowledge={onSaveToKnowledge ? () => onSaveToKnowledge(msg.id) : undefined}
                        onViewSources={onViewSources ? () => onViewSources(msg.id) : undefined}
                        reaction={msg.reaction ?? null}
                        isRegenerating={isGenerating && regeneratingMessageId === msg.id}
                        isDeleted={Boolean(msg.isDeleted)}
                        copied={copiedMessageId === msg.id}
                        isPinned={Boolean(msg.isPinned)}
                        hasSources={hasSources?.(msg.id) ?? false}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } }}
              exit={{ opacity: 0, y: 10, transition: { duration: 0.16, ease: "easeInOut" } }}
              className="w-full flex justify-start mb-4"
            >
              <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 inline-flex items-center gap-1.5">
                {[0, 0.12, 0.24].map((delay, index) => (
                  <motion.span
                    key={`ai-typing-${index}`}
                    className="h-1.5 w-1.5 rounded-full bg-cyan-300"
                    variants={typingDotVariant}
                    animate="animate"
                    transition={{ duration: 0.36, ease: "easeInOut", repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCopiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-slate-900/95 px-3 py-1 text-xs text-cyan-100 shadow-lg"
          >
            Copied
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {unseenCount > 0 && !isAtBottom && (
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
    </div>
  );
}
