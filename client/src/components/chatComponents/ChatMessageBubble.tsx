import { useEffect, useState } from "react";
import type { Message } from "./types";
import { MessageStatusDots } from "./MessageStatusDots";
import { BsStarFill } from "react-icons/bs";
import MessageReactionStrip from "./MessageReactionStrip";

export default function ChatMessageBubble({
  message,
  onToggleReaction,
  autoDownloadMedia = true,
}: {
  message: Message;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  autoDownloadMedia?: boolean;
}) {
  const mine = message.sender === "me";
  const isDeleted = Boolean(message.deletedForEveryone);
  const hasMedia = Boolean(message.mediaUrl);
  const quote = message.replyTo;
  const isUploading = Boolean(message.isUploading);
  const uploadProgress = Math.max(0, Math.min(100, Math.round(message.uploadProgress ?? 0)));
  const [canLoadMedia, setCanLoadMedia] = useState(autoDownloadMedia);

  useEffect(() => {
    if (autoDownloadMedia) {
      setCanLoadMedia(true);
    }
  }, [autoDownloadMedia]);

  const getSnippet = () => {
    if (!quote) return "";
    if (quote.messageType === "IMAGE") return "Photo";
    if (quote.messageType === "VIDEO") return "Video";
    if (quote.messageType === "FILE") return quote.content || "File";
    return quote.content || "Message";
  };

  const renderReplyPreview = () => {
    if (!quote) return null;
    if (quote.deletedForEveryone) {
      return <div className="truncate">This message was deleted</div>;
    }

    const label = getSnippet() || "Media";

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
  };

  const renderBody = () => {
    if (isDeleted) {
      return <div className="italic text-sm opacity-90">This message was deleted</div>;
    }

    if (!hasMedia) {
      return <div>{message.text}</div>;
    }

    if (!canLoadMedia) {
      return (
        <button
          type="button"
          onClick={() => setCanLoadMedia(true)}
          className="w-full rounded-xl border border-white/25 bg-black/20 px-3 py-6 text-xs"
        >
          Tap to download
        </button>
      );
    }

    if (message.messageType === "IMAGE") {
      return (
        <img
          src={message.mediaUrl}
          alt={message.text || "image"}
          className="max-h-72 w-full rounded-xl object-cover"
          loading="lazy"
        />
      );
    }

    if (message.messageType === "VIDEO") {
      return (
        <video className="max-h-72 w-full rounded-xl" controls>
          <source src={message.mediaUrl} />
        </video>
      );
    }

    if (
      message.mediaUrl &&
      (message.mediaUrl.startsWith("data:audio/") ||
        /\.(mp3|wav|ogg|m4a|webm)$/i.test(message.mediaUrl) ||
        /voice message/i.test(message.text || ""))
    ) {
      return (
        <audio controls className="w-full rounded-lg">
          <source src={message.mediaUrl} />
        </audio>
      );
    }

    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl bg-black/20 px-3 py-2 text-xs underline underline-offset-2"
      >
        {message.text || "Open file"}
      </a>
    );
  };

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] ${mine ? "" : "min-w-[96px]"}`}>
        <div
          data-message-bubble="true"
          className={`relative px-4 py-2 rounded-2xl text-sm leading-relaxed
            ${isDeleted ? "w-fit max-w-full" : ""}
            ${mine
              ? "message-bubble-right border border-cyan-300/35 bg-gradient-to-br from-cyan-500/85 to-sky-600/85 text-white rounded-br-none shadow-[0_12px_35px_-20px_rgba(34,211,238,0.85)]"
              : "message-bubble-left border border-cyan-400/25 bg-zinc-900/75 text-zinc-100 rounded-bl-none shadow-[0_12px_35px_-22px_rgba(0,0,0,0.9)]"
            }
          `}
        >
          {message.isForwarded && (
            <div className={`mb-1 text-[11px] ${mine ? "text-white/70" : "text-zinc-300/80"}`}>
              Forwarded
            </div>
          )}

          {message.starred && (
            <span className="absolute top-2 right-2 text-yellow-300">
              <BsStarFill size={12} />
            </span>
          )}

          {(quote || message.replyToId) && (
            <div
              className={`mb-2 rounded-lg border-l-2 px-2 py-1 text-xs ${
                mine
                  ? "border-cyan-300/80 bg-black/20 text-white/80"
                  : "border-sky-400/70 bg-black/25 text-zinc-200"
              }`}
            >
              <div className="font-medium">{quote ? quote.senderName : "Message deleted"}</div>
              {quote ? renderReplyPreview() : <div className="truncate">This message was deleted</div>}
            </div>
          )}

          {/* Message content */}
          {renderBody()}
          {hasMedia && message.text && (
            <div className="mt-2 whitespace-pre-wrap break-words text-sm">
              {message.text}
            </div>
          )}

          {/* Footer */}
          {isUploading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  background: `conic-gradient(rgba(255,255,255,0.95) ${uploadProgress * 3.6}deg, rgba(255,255,255,0.2) 0deg)`,
                }}
              />
              <span>Uploading... {uploadProgress}%</span>
            </div>
          )}

          {!isUploading && (
            <div
              className={`mt-1 flex items-center gap-3 text-xs ${
                mine ? "justify-between text-white/75" : "justify-end text-zinc-200/80"
              }`}
            >
              <span>{message.time}</span>
              {mine && <MessageStatusDots status={message.status} />}
            </div>
          )}
        </div>

        {message.kind !== "SYSTEM" && (
          <MessageReactionStrip
            messageId={message.id}
            summary={message.reactionSummary ?? []}
            onToggleReaction={onToggleReaction}
          />
        )}
      </div>
    </div>
  );
}
