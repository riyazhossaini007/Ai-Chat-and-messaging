import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, Pause, Play } from "lucide-react";
import { BsStarFill } from "react-icons/bs";
import GroupSendDots from "./GroupSendDots";
import MessageReactionStrip from "./MessageReactionStrip";
import MessageActionsMenu from "./MessageActionsMenu";
import { hoverRevealVariant, layoutTransition, optimizedMotionStyle } from "../../lib/motionVariants";

export type GroupMessage = {
  id: string;
  localId?: string;
  senderId: string | null;
  senderName: string;
  senderAvatar?: string;
  chatType?: "GROUP";
  kind?: "USER" | "SYSTEM";
  systemEvent?:
    | "MEMBER_JOIN"
    | "MEMBER_LEAVE"
    | "MEMBER_ADDED"
    | "MEMBER_REMOVED"
    | "ADMIN_PROMOTED"
    | "ADMIN_DEMOTED"
    | "GROUP_UPDATED"
    | "RULES_UPDATED"
    | null;
  contentType: "text" | "image" | "video" | "file" | "location";
  content: unknown;
  mediaUrl?: string;
  replyToId?: string;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
    mediaUrl?: string;
    messageType: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    deletedForEveryone?: boolean;
  } | null;
  createdAt: string;
  isMine: boolean;
  readCount: number;
  deliveredToAtLeastOne?: boolean;
  localStatus?: "SENDING";
  starred?: boolean;
  reactionSummary?: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
  deletedForEveryone?: boolean;
};

type GroupMessageBubbleProps = {
  message: GroupMessage;
  showAvatar?: boolean;
  showName?: boolean;
  isLastInGroup?: boolean;
  disableActions?: boolean;
  canDelete?: boolean;
  menuOpen?: boolean;
  onRequestMenuOpen?: (messageId: string) => void;
  onRequestMenuClose?: () => void;
  onShare?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onAskAi?: (messageId: string) => void;
  onCopy?: (messageId: string, content: string) => void;
  onForward?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onSaveToMemory?: (messageId: string) => void;
  onSaveToKnowledge?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onSelectionTrigger?: (messageId: string) => boolean | void;
  onReplyPreviewClick?: (messageId: string) => void;
  onOpenSeenBy?: (messageId: string) => void;
  onOpenMedia?: (payload: {
    type: "IMAGE" | "VIDEO";
    url: string;
    caption?: string;
    messageId: string;
  }) => void;
  autoDownloadMedia?: boolean;
};

const nameColors = [
  "text-emerald-300",
  "text-sky-300",
  "text-amber-300",
  "text-fuchsia-300",
  "text-rose-300",
  "text-lime-300",
  "text-violet-300",
];

function colorForSender(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % nameColors.length;
  return nameColors[index];
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const resolveSendState = (
  message: Pick<GroupMessage, "isMine" | "localStatus" | "readCount" | "deliveredToAtLeastOne">
) => {
  if (message.localStatus === "SENDING") return "SENDING" as const;
  if (message.readCount >= 1) return "READ" as const;
  if (message.deliveredToAtLeastOne) return "DELIVERED" as const;
  return "SENT" as const;
};

const isAudioUrl = (url: string, caption?: string) => {
  if (!url) return false;
  if (url.startsWith("data:audio/")) return true;
  if (/\.(mp3|wav|ogg|m4a|webm|aac|flac)$/i.test(url)) return true;
  return /voice message/i.test(caption ?? "");
};

function getReplySnippet(quote: NonNullable<GroupMessage["replyTo"]>) {
  if (quote.messageType === "IMAGE") return "Photo";
  if (quote.messageType === "VIDEO") return "Video";
  if (quote.messageType === "FILE") return quote.content || "Document";
  return quote.content || "Message";
}

function renderReplyPreview(quote: NonNullable<GroupMessage["replyTo"]>) {
  if (quote.deletedForEveryone) {
    return <div className="truncate">This message was deleted</div>;
  }

  const label = getReplySnippet(quote) || "Media";
  if (quote.messageType === "IMAGE" && quote.mediaUrl) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="truncate">{label}</div>
        <img
          src={quote.mediaUrl}
          alt="Replied image"
          className="h-10 w-10 rounded object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (quote.messageType === "VIDEO" && quote.mediaUrl) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="truncate">{label}</div>
        <video className="h-10 w-10 rounded object-cover" muted playsInline preload="metadata">
          <source src={quote.mediaUrl} />
        </video>
      </div>
    );
  }

  return <div className="truncate">{label}</div>;
}

export default function GroupMessageBubble({
  message,
  showAvatar = true,
  showName = true,
  isLastInGroup = true,
  disableActions = false,
  canDelete = false,
  menuOpen = false,
  onRequestMenuOpen,
  onRequestMenuClose,
  onShare,
  onReply,
  onAskAi,
  onCopy,
  onForward,
  onStar,
  onSaveToMemory,
  onSaveToKnowledge,
  onDelete,
  onReact,
  onSelectionTrigger,
  onReplyPreviewClick,
  onOpenSeenBy,
  onOpenMedia,
  autoDownloadMedia = true,
}: GroupMessageBubbleProps) {
  const mine = message.isMine;
  const isSystem = message.kind === "SYSTEM";
  const quote = message.replyTo;
  const [canLoadMedia, setCanLoadMedia] = useState(autoDownloadMedia);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (autoDownloadMedia) {
      setCanLoadMedia(true);
    }
  }, [autoDownloadMedia]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsAudioPlaying(true);
    const onPause = () => setIsAudioPlaying(false);
    const onEnded = () => setIsAudioPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [message.id]);

  if (isSystem) {
    return (
      <div className="mb-3 flex justify-center">
        <div className="rounded-full border border-zinc-800/80 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-400">
          <span>{String(message.content)}</span>
          <span className="ml-2 text-[10px] text-zinc-500">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  const resolvedMediaUrl =
    message.mediaUrl ??
    (typeof message.content === "string" &&
    (/^data:/i.test(message.content) || /^https?:\/\//i.test(message.content))
      ? message.content
      : undefined);
  const nameColor = colorForSender(message.senderId ?? "system");
  const sendState = resolveSendState(message);
  const contentText =
    typeof message.content === "string"
      ? message.content
      : typeof message.content === "object" && message.content && "name" in message.content
      ? String((message.content as { name?: string }).name ?? "")
      : "";

  const menuMessage = useMemo(
    () => ({
      id: message.id,
      sender: mine ? ("me" as const) : ("them" as const),
      content: contentText,
      text: contentText,
      mediaUrl: resolvedMediaUrl,
      messageType:
        message.contentType === "image"
          ? ("IMAGE" as const)
          : message.contentType === "video"
          ? ("VIDEO" as const)
          : message.contentType === "file"
          ? ("FILE" as const)
          : ("TEXT" as const),
      time: formatTime(message.createdAt),
      starred: message.starred,
      deletedForEveryone: message.deletedForEveryone,
      reactionSummary: message.reactionSummary ?? [],
    }),
    [
      contentText,
      message.contentType,
      message.createdAt,
      message.deletedForEveryone,
      message.id,
      message.reactionSummary,
      message.starred,
      mine,
      resolvedMediaUrl,
    ]
  );

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const renderContent = () => {
    if ((message.contentType === "image" || message.contentType === "video") && !canLoadMedia) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setCanLoadMedia(true);
          }}
          className="w-full rounded-xl border border-white/25 bg-black/20 px-3 py-6 text-xs"
        >
          Tap to download
        </button>
      );
    }

    if (message.contentType === "image" && resolvedMediaUrl) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMedia?.({
              type: "IMAGE",
              url: resolvedMediaUrl,
              caption: contentText,
              messageId: message.id,
            });
          }}
          className="block w-full overflow-hidden rounded-xl"
        >
          <motion.img
            src={resolvedMediaUrl}
            alt="attachment"
            layoutId={`media-${message.id}`}
            className="max-h-64 w-full rounded-xl object-cover"
            loading="lazy"
          />
        </button>
      );
    }

    if (message.contentType === "video" && resolvedMediaUrl) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMedia?.({
              type: "VIDEO",
              url: resolvedMediaUrl,
              caption: contentText,
              messageId: message.id,
            });
          }}
          className="relative block w-full overflow-hidden rounded-xl"
        >
          <video className="max-h-64 w-full rounded-xl object-cover" preload="metadata">
            <source src={resolvedMediaUrl} />
          </video>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/45 p-2 text-white">Play</span>
          </span>
        </button>
      );
    }

    if (message.contentType === "file") {
      if (resolvedMediaUrl && isAudioUrl(resolvedMediaUrl, contentText)) {
        return (
          <div className="rounded-xl border border-white/20 bg-black/25 px-3 py-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const audio = audioRef.current;
                if (!audio) return;
                if (audio.paused) {
                  void audio.play();
                  return;
                }
                audio.pause();
              }}
              className="flex w-full items-center gap-2 text-left text-sm text-white/95"
            >
              <span className="rounded-full bg-white/15 p-1">
                {isAudioPlaying ? <Pause size={14} /> : <Play size={14} />}
              </span>
              <span className="truncate">{isAudioPlaying ? "Pause audio" : "Play audio"}</span>
            </button>
            <audio ref={audioRef} preload="metadata" className="hidden">
              <source src={resolvedMediaUrl} />
            </audio>
          </div>
        );
      }

      if (resolvedMediaUrl) {
        return (
          <a
            href={resolvedMediaUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="block rounded-lg border border-border-subtle bg-bg-surface/60 px-3 py-2 text-xs text-text-secondary underline underline-offset-2"
          >
            {contentText || "Open file"}
          </a>
        );
      }

      return (
        <div className="rounded-lg border border-border-subtle bg-bg-surface/60 px-3 py-2 text-xs text-text-secondary">
          {contentText || "File attachment"}
        </div>
      );
    }

    if (message.contentType === "location") {
      const location = message.content as { lat?: unknown; lng?: unknown } | null;
      return (
        <div className="rounded-lg border border-border-subtle bg-bg-surface/60 px-3 py-2 text-xs text-text-secondary">
          Location: {String(location?.lat ?? "-")}, {String(location?.lng ?? "-")}
        </div>
      );
    }

    return <div className="whitespace-pre-wrap">{contentText}</div>;
  };

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-3" : "mb-1"}`}>
      {!mine && showAvatar && (
        <div className="mr-2 mt-1 h-8 w-8 overflow-hidden rounded-full border border-border-subtle bg-bg-surface">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt={message.senderName} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-primary-gradient" />
          )}
        </div>
      )}

      <div
        className="group relative flex min-w-0 max-w-[70%] flex-col"
        onMouseEnter={() => setShowQuickAction(true)}
        onMouseLeave={() => setShowQuickAction(false)}
        onFocusCapture={() => setShowQuickAction(true)}
        onBlurCapture={() => setShowQuickAction(false)}
      >
        {!disableActions && (
          <motion.button
            ref={iconRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              if (menuOpen) {
                onRequestMenuClose?.();
                return;
              }
              onRequestMenuOpen?.(message.id);
            }}
            variants={hoverRevealVariant}
            initial="initial"
            animate={showQuickAction || menuOpen ? "hover" : "initial"}
            style={optimizedMotionStyle}
            className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-zinc-200 ${
              mine ? "-left-8" : "-right-8"
            }`}
          >
            <ChevronDown size={14} />
          </motion.button>
        )}

        <div
          onPointerDown={(event) => {
            if (disableActions || event.pointerType !== "touch") return;
            clearLongPress();
            longPressTimerRef.current = window.setTimeout(() => {
              const handled = onSelectionTrigger?.(message.id);
              if (handled) return;
              onRequestMenuOpen?.(message.id);
            }, 420);
          }}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
        >
          <motion.div
            data-message-bubble="true"
            layout
            transition={layoutTransition}
            style={optimizedMotionStyle}
            className={`relative rounded-2xl px-4 py-2 text-sm leading-relaxed transition ${
              message.deletedForEveryone ? "w-fit max-w-full" : ""
            } ${
              mine
                ? "rounded-br-sm border border-cyan-300/35 bg-gradient-to-br from-cyan-500/85 to-sky-600/85 text-white shadow-[0_12px_35px_-20px_rgba(34,211,238,0.85)]"
                : "min-w-[96px] rounded-bl-sm border border-cyan-400/25 bg-zinc-900/75 text-zinc-100 shadow-[0_12px_35px_-22px_rgba(0,0,0,0.9)]"
            }`}
          >
            {!mine && showName && (
              <div className={`mb-1 text-xs font-semibold ${nameColor}`}>{message.senderName}</div>
            )}

            {message.starred && (
              <span className="absolute right-2 top-2 text-yellow-300">
                <BsStarFill size={12} />
              </span>
            )}

            {(quote || message.replyToId) && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (message.replyToId) {
                    onReplyPreviewClick?.(message.replyToId);
                  }
                }}
                className={`mb-2 w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
                  mine
                    ? "border-cyan-300/80 bg-black/20 text-white/80"
                    : "border-sky-400/70 bg-black/25 text-zinc-200"
                }`}
              >
                <div className="font-medium">{quote ? quote.senderName : "Original message"}</div>
                {quote ? (
                  renderReplyPreview(quote)
                ) : (
                  <div className="truncate">Original message not available.</div>
                )}
              </button>
            )}

            {renderContent()}

            <div
              className={`mt-1 flex items-center gap-1 text-xs ${
                mine ? "justify-between text-white/60" : "justify-end text-zinc-200/80"
              }`}
            >
              <span>{formatTime(message.createdAt)}</span>
              {mine && message.kind !== "SYSTEM" && (
                <GroupSendDots
                  state={sendState}
                  readCount={message.readCount}
                  onOpenSeenBy={() => onOpenSeenBy?.(message.id)}
                />
              )}
            </div>
          </motion.div>
        </div>

        <div className={`${mine ? "mt-1 flex justify-end" : "mt-1 flex justify-start"}`}>
          <MessageReactionStrip
            messageId={message.id}
            summary={message.reactionSummary ?? []}
            onToggleReaction={onReact}
          />
        </div>
      </div>

      {!disableActions && (
        <MessageActionsMenu
          open={menuOpen}
          onClose={() => onRequestMenuClose?.()}
          message={menuMessage}
          isMine={mine}
          anchorRef={iconRef}
          onCopy={onCopy}
          onReply={onReply}
          onAskAi={onAskAi}
          onShare={onShare}
          onForward={onForward}
          onStar={onStar}
          onSaveToMemory={onSaveToMemory}
          onSaveToKnowledge={onSaveToKnowledge}
          onReact={onReact}
          onDeleteForMe={onDelete}
          onDeleteForEveryone={canDelete ? onDelete : undefined}
          onDownload={() => {
            if (!resolvedMediaUrl) return;
            const link = document.createElement("a");
            link.href = resolvedMediaUrl;
            link.download = `group-message-${message.id}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        />
      )}
    </div>
  );
}
