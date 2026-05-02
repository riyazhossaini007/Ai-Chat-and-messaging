import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { BsStarFill } from "react-icons/bs";
import { Pause, Play } from "lucide-react";
import { MessageStatusDots } from "./MessageStatusDots";
import MessageReactionStrip from "./MessageReactionStrip";
import type { Message } from "./types";
import { layoutTransition, optimizedMotionStyle } from "../../lib/motionVariants";

type MessageBubbleProps = {
  message: Message;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  autoDownloadMedia?: boolean;
  onOpenMedia?: (payload: {
    type: "IMAGE" | "VIDEO";
    url: string;
    caption?: string;
    messageId: string;
  }) => void;
};

const isAudioMessage = (message: Message) => {
  const url = message.mediaUrl ?? "";
  if (!url || message.messageType !== "FILE") return false;
  if (url.startsWith("data:audio/")) return true;
  if (/\.(mp3|wav|ogg|m4a|webm|aac|flac)$/i.test(url)) return true;
  return /voice message/i.test(message.text || "");
};

export default function MessageBubble({
  message,
  onToggleReaction,
  autoDownloadMedia = true,
  onOpenMedia,
}: MessageBubbleProps) {
  const mine = message.sender === "me";
  const isDeleted = Boolean(message.deletedForEveryone);
  const hasMedia = Boolean(message.mediaUrl);
  const isUploading = Boolean(message.isUploading);
  const uploadProgress = Math.max(0, Math.min(100, Math.round(message.uploadProgress ?? 0)));
  const quote = message.replyTo;
  const [canLoadMedia, setCanLoadMedia] = useState(autoDownloadMedia);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioMessage = useMemo(() => isAudioMessage(message), [message]);

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

  const getReplySnippet = () => {
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

    const label = getReplySnippet() || "Media";

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

  const handleAudioToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  };

  const renderBody = () => {
    if (isDeleted) {
      return <div className="italic text-sm opacity-90">This message was deleted</div>;
    }

    if (message.decryptError) {
      return (
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Message unavailable. Tap to retry.
        </div>
      );
    }

    if (!hasMedia) {
      return <div className="whitespace-pre-wrap break-words">{message.text}</div>;
    }

    if (!canLoadMedia) {
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

    if (message.messageType === "IMAGE" && message.mediaUrl) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMedia?.({
              type: "IMAGE",
              url: message.mediaUrl ?? "",
              caption: message.text ?? undefined,
              messageId: message.id,
            });
          }}
          className="block w-full overflow-hidden rounded-xl"
        >
          <motion.img
            src={message.mediaUrl}
            alt={message.text || "image"}
            layoutId={`media-${message.id}`}
            className="max-h-72 w-full rounded-xl object-cover"
            loading="lazy"
          />
        </button>
      );
    }

    if (message.messageType === "VIDEO" && message.mediaUrl) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMedia?.({
              type: "VIDEO",
              url: message.mediaUrl ?? "",
              caption: message.text ?? undefined,
              messageId: message.id,
            });
          }}
          className="relative block w-full overflow-hidden rounded-xl"
        >
          <video className="max-h-72 w-full rounded-xl object-cover" preload="metadata">
            <source src={message.mediaUrl} />
          </video>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/45 p-2 text-white">Play</span>
          </span>
        </button>
      );
    }

    if (audioMessage && message.mediaUrl) {
      return (
        <div className="rounded-xl border border-white/20 bg-black/25 px-3 py-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleAudioToggle();
            }}
            className="flex w-full items-center gap-2 text-left text-sm text-white/95"
          >
            <span className="rounded-full bg-white/15 p-1">
              {isAudioPlaying ? <Pause size={14} /> : <Play size={14} />}
            </span>
            <span className="truncate">{isAudioPlaying ? "Pause audio" : "Play audio"}</span>
          </button>
          <audio ref={audioRef} preload="metadata" className="hidden">
            <source src={message.mediaUrl} />
          </audio>
        </div>
      );
    }

    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="block rounded-xl bg-black/20 px-3 py-2 text-xs underline underline-offset-2"
      >
        {message.text || "Open file"}
      </a>
    );
  };

  return (
    <>
      <motion.div
        data-message-bubble="true"
        layout
        transition={layoutTransition}
        style={optimizedMotionStyle}
        className={`relative rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isDeleted ? "w-fit max-w-full" : ""
        } ${
          mine
            ? "message-bubble-right border border-cyan-300/35 bg-gradient-to-br from-cyan-500/85 to-sky-600/85 text-white rounded-br-none shadow-[0_12px_35px_-20px_rgba(34,211,238,0.85)]"
            : "message-bubble-left min-w-[96px] border border-cyan-400/25 bg-zinc-900/75 text-zinc-100 rounded-bl-none shadow-[0_12px_35px_-22px_rgba(0,0,0,0.9)]"
        }`}
      >
        {message.isForwarded && (
          <div className={`mb-1 text-[11px] ${mine ? "text-white/70" : "text-zinc-300/80"}`}>
            Forwarded
          </div>
        )}

        {message.starred && (
          <span className="absolute right-2 top-2 text-yellow-300">
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

        {renderBody()}

        {hasMedia && message.text && message.messageType !== "TEXT" && (
          <div className="mt-2 whitespace-pre-wrap break-words text-sm">{message.text}</div>
        )}

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
      </motion.div>

      {message.kind !== "SYSTEM" && (
        <MessageReactionStrip
          messageId={message.id}
          summary={message.reactionSummary ?? []}
          onToggleReaction={onToggleReaction}
        />
      )}
    </>
  );
}
