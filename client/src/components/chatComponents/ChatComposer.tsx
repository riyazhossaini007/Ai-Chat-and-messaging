import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  BsCameraVideo,
  BsEmojiSmile,
  BsFillSendFill,
  BsImages,
  BsMic,
  BsPaperclip,
  BsPlusLg,
  BsX,
} from "react-icons/bs";
import { fadeScaleVariant, optimizedMotionStyle } from "../../lib/motionVariants";
import { getApiErrorMessage } from "../../lib/api";

export type ChatComposerPayload = {
  text?: string;
  files?: File[];
  replyToId?: string;
  gifUrl?: string;
  voiceBlob?: Blob;
  voiceDurationSeconds?: number;
  videoBlob?: Blob;
  videoDurationSeconds?: number;
};

type ReplyPreview = {
  id: string;
  senderName: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  content: string;
  mediaUrl?: string;
};

type ForwardPreview = {
  id: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  content?: string | null;
  mediaUrl?: string | null;
};

const EMOJI_LIBRARY = {
  Smileys: ["😀", "😄", "😁", "😂", "🙂", "😉", "😍", "😘", "😎", "🤔", "😴", "😭", "😡"],
  Gestures: ["👍", "🙏", "👏", "👋", "💪", "🙌", "🤝", "👌", "🔥", "💯"],
  Symbols: ["❤️", "💛", "💚", "💙", "💜", "✨", "✅", "❌", "⭐", "🎉", "🚀"],
} as const;

const TRENDING_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDE5dTJzNWxmeHdneXVudGdqZ2hja2h1YXlkY2N4cWp4YTVyMzd4bSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26BRuo6sLetdllPAQ/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2RlMzR2aG4zZ3RrenQ0NTRjbnQ4N3Vvc3NnM2Nrb2V0dmJndWE3cyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXRuNWo5MXA5a2xwMnlnYWdwdzV0a2syMGdlNHpnN3J5d3N1OW5zYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7TKMt1VVNkHV2PaE/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcThob3A2Mm0xNmZsN2Y4N2E0dmpnOTRlbG00aXJvMm9vcnlhc2hyNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/MDJ9IbxxvDUQM/giphy.gif",
];

const RECENT_EMOJI_KEY = "plaxe_recent_emoji";
const DEFAULT_MAX_FILE_SIZE_MB = 20;
const DEFAULT_MAX_AUDIO_SECONDS = 180;
const DEFAULT_MAX_VIDEO_SECONDS = 60;

const formatTimer = (valueSeconds: number) => {
  const minutes = Math.floor(valueSeconds / 60);
  const seconds = Math.floor(valueSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getReplySnippet = (replyTo: ReplyPreview) => {
  if (replyTo.type === "IMAGE") return "Photo";
  if (replyTo.type === "VIDEO") return "Video";
  if (replyTo.type === "FILE") return replyTo.content || "File";
  return replyTo.content || "Message";
};

const getForwardSnippet = (item: ForwardPreview) => {
  if (item.type === "IMAGE") return "Photo";
  if (item.type === "VIDEO") return "Video";
  if (item.type === "FILE") return item.content || "File";
  return item.content || "Message";
};

export default function ChatComposer({
  onSend,
  onForwardSend,
  replyTo,
  onCancelReply,
  forwardMessages,
  onCancelForward,
  onTypingStart,
  onTypingStop,
  chatId,
  maxFileSizeMB = DEFAULT_MAX_FILE_SIZE_MB,
  maxAudioSeconds = DEFAULT_MAX_AUDIO_SECONDS,
  maxVideoSeconds = DEFAULT_MAX_VIDEO_SECONDS,
  isSending = false,
  enterToSend = true,
}: {
  onSend: (payload: ChatComposerPayload) => Promise<void> | void;
  onForwardSend?: () => void;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  forwardMessages?: ForwardPreview[];
  onCancelForward?: () => void;
  onTypingStart?: (chatId?: string) => void;
  onTypingStop?: (chatId?: string) => void;
  chatId?: string;
  maxFileSizeMB?: number;
  maxAudioSeconds?: number;
  maxVideoSeconds?: number;
  isSending?: boolean;
  enterToSend?: boolean;
}) {
  const isBrowser = typeof document !== "undefined";
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [recentEmoji, setRecentEmoji] = useState<string[]>([]);
  const [typingActive, setTypingActive] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceBlobUrl, setVoiceBlobUrl] = useState<string | null>(null);
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState<number | undefined>(undefined);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | undefined>(undefined);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isVideoRecordingPaused, setIsVideoRecordingPaused] = useState(false);
  const [videoRecordSeconds, setVideoRecordSeconds] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [emptyActionHint, setEmptyActionHint] = useState<"mic" | "media">("mic");
  const [gifRateLimited, setGifRateLimited] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingStopTimeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordSecondsRef = useRef(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<number | null>(null);
  const videoRecordSecondsRef = useRef(0);
  const gifRateLimitRef = useRef<number[]>([]);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  const filteredEmojiGroups = useMemo(() => {
    const query = emojiSearch.trim();
    if (!query) return EMOJI_LIBRARY;
    const matched = Object.entries(EMOJI_LIBRARY).reduce<Record<string, string[]>>((acc, [key, values]) => {
      const result = values.filter((emoji) => emoji.includes(query));
      if (result.length > 0) {
        acc[key] = result;
      }
      return acc;
    }, {});
    return matched;
  }, [emojiSearch]);

  const filteredGifUrls = useMemo(() => {
    const query = gifSearch.trim().toLowerCase();
    if (!query) return TRENDING_GIFS;
    return TRENDING_GIFS.filter((gifUrl) => gifUrl.toLowerCase().includes(query));
  }, [gifSearch]);

  const hasForwardMode = Boolean(forwardMessages && forwardMessages.length > 0);
  const hasSendPayload = Boolean(text.trim() || files.length > 0 || voiceBlob || videoBlob || hasForwardMode);

  useEffect(() => {
    const raw = localStorage.getItem(RECENT_EMOJI_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      setRecentEmoji(Array.isArray(parsed) ? parsed.slice(0, 24) : []);
    } catch {
      setRecentEmoji([]);
    }
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
      if (typingStopTimeoutRef.current) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (videoTimerRef.current) {
        window.clearInterval(videoTimerRef.current);
      }
      if (voiceBlobUrl) {
        URL.revokeObjectURL(voiceBlobUrl);
      }
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previews, videoBlobUrl, voiceBlobUrl]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (actionMenuRef.current?.contains(target)) return;
      setActionsOpen(false);
      setEmojiOpen(false);
      setMediaPickerOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!hasForwardMode) return;
    setText("");
    setFiles([]);
    setVoiceBlob(null);
    setVoiceDurationSeconds(undefined);
    setVideoBlob(null);
    setVideoDurationSeconds(undefined);
    if (voiceBlobUrl) {
      URL.revokeObjectURL(voiceBlobUrl);
      setVoiceBlobUrl(null);
    }
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    onTypingStop?.(chatId);
    setTypingActive(false);
  }, [chatId, hasForwardMode, onTypingStop, videoBlobUrl, voiceBlobUrl]);

  useEffect(() => {
    if (hasSendPayload || isRecording || isVideoRecording || mediaPickerOpen || videoRecorderOpen) return;
    const interval = window.setInterval(() => {
      setEmptyActionHint((prev) => (prev === "mic" ? "media" : "mic"));
    }, 2400);
    return () => window.clearInterval(interval);
  }, [hasSendPayload, isRecording, isVideoRecording, mediaPickerOpen, videoRecorderOpen]);

  useEffect(() => {
    const preview = videoPreviewRef.current;
    if (!preview) return;
    if (videoRecorderOpen && videoStreamRef.current) {
      preview.srcObject = videoStreamRef.current;
      void preview.play().catch(() => undefined);
      return;
    }
    preview.srcObject = null;
  }, [videoRecorderOpen, videoStreamRef.current]);

  const queueTypingStop = () => {
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }
    typingStopTimeoutRef.current = window.setTimeout(() => {
      if (!typingActive) return;
      onTypingStop?.(chatId);
      setTypingActive(false);
    }, 2000);
  };

  const emitTyping = () => {
    if (!typingActive) {
      onTypingStart?.(chatId);
      setTypingActive(true);
    }
    queueTypingStop();
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (sendError) setSendError(null);
    if (value.trim().length > 0) {
      emitTyping();
      return;
    }
    onTypingStop?.(chatId);
    setTypingActive(false);
  };

  const pushRecentEmoji = (emoji: string) => {
    setRecentEmoji((prev) => {
      const next = [emoji, ...prev.filter((item) => item !== emoji)].slice(0, 24);
      localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => `${prev}${emoji}`);
    pushRecentEmoji(emoji);
    emitTyping();
  };

  const handleOpenAttachment = () => {
    fileInputRef.current?.click();
  };

  const filterByLimits = (incoming: File[]) =>
    incoming.filter((file) => file.size <= maxFileSizeMB * 1024 * 1024);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const allFiles = Array.from(incoming);
    const allowed = filterByLimits(allFiles);
    const rejectedCount = allFiles.length - allowed.length;
    if (rejectedCount > 0) {
      setSendError(
        `Max file size is ${maxFileSizeMB}MB. ${rejectedCount} file${rejectedCount === 1 ? "" : "s"} skipped.`
      );
    }
    if (allowed.length === 0) return;
    if (!rejectedCount && sendError) setSendError(null);
    setFiles((prev) => [...prev, ...allowed]);
  };

  const clearVoice = () => {
    setVoiceBlob(null);
    setVoiceDurationSeconds(undefined);
    if (voiceBlobUrl) {
      URL.revokeObjectURL(voiceBlobUrl);
      setVoiceBlobUrl(null);
    }
  };

  const clearVideo = () => {
    setVideoBlob(null);
    setVideoDurationSeconds(undefined);
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
  };

  const clearInputState = () => {
    setText("");
    setFiles([]);
    clearVoice();
    clearVideo();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onTypingStop?.(chatId);
    setTypingActive(false);
  };

  const handleSend = async () => {
    if (hasForwardMode) {
      onForwardSend?.();
      return;
    }
    if (!text.trim() && files.length === 0 && !voiceBlob) return;

    setSendError(null);
    try {
      await onSend({
        text: text.trim() || undefined,
        files: files.length ? files : undefined,
        replyToId: replyTo?.id,
        voiceBlob: voiceBlob ?? undefined,
        voiceDurationSeconds,
        videoBlob: videoBlob ?? undefined,
        videoDurationSeconds,
      });
      clearInputState();
      onCancelReply?.();
    } catch (error) {
      setSendError(getApiErrorMessage(error));
    }
  };

  const handleGifSend = (gifUrl: string) => {
    const now = Date.now();
    const nextWindow = [...gifRateLimitRef.current, now].filter((time) => now - time <= 60_000);
    gifRateLimitRef.current = nextWindow;
    if (nextWindow.length >= 10) {
      setGifRateLimited(true);
      return;
    }

    onSend({
      gifUrl,
      replyToId: replyTo?.id,
    });
    setGifOpen(false);
    setGifSearch("");
    onCancelReply?.();
  };

  const startRecording = async () => {
    if (isRecording) return;
    setRecordError(null);
    setVideoError(null);
    setGifRateLimited(false);
    setMediaPickerOpen(false);
    setIsRecordingPaused(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];
      setRecordSeconds(0);
      recordSecondsRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        const duration = Math.max(1, recordSecondsRef.current);
        if (duration > maxAudioSeconds) {
          setRecordError(`Audio is limited to ${maxAudioSeconds} seconds.`);
          clearVoice();
        } else {
          clearVoice();
          const url = URL.createObjectURL(blob);
          setVoiceBlob(blob);
          setVoiceBlobUrl(url);
          setVoiceDurationSeconds(duration);
        }
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          recordSecondsRef.current = next;
          if (next >= maxAudioSeconds) {
            mediaRecorder.stop();
            setIsRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch {
      setRecordError("Microphone permission denied.");
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!isRecording || isRecordingPaused || !recorder || recorder.state !== "recording") return;
    recorder.pause();
    setIsRecordingPaused(true);
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!isRecording || !isRecordingPaused || !recorder || recorder.state !== "paused") return;
    recorder.resume();
    setIsRecordingPaused(false);
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
    }
    recordingTimerRef.current = window.setInterval(() => {
      setRecordSeconds((prev) => {
        const next = prev + 1;
        recordSecondsRef.current = next;
        if (next >= maxAudioSeconds) {
          recorder.stop();
          setIsRecording(false);
          setIsRecordingPaused(false);
        }
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsRecordingPaused(false);
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  const stopVideoRecorderStream = () => {
    if (videoTimerRef.current) {
      window.clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    videoRecorderRef.current = null;
  };

  const openVideoRecorder = async () => {
    if (videoRecorderOpen) return;
    setVideoError(null);
    setRecordError(null);
    setMediaPickerOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 1280 },
          facingMode: "user",
        },
        audio: true,
      });
      videoStreamRef.current = stream;
      setVideoRecordSeconds(0);
      videoRecordSecondsRef.current = 0;
      setIsVideoRecordingPaused(false);
      setVideoRecorderOpen(true);
    } catch {
      setVideoError("Camera or microphone permission denied.");
    }
  };

  const closeVideoRecorder = () => {
    if (isVideoRecording) {
      videoRecorderRef.current?.stop();
      setIsVideoRecording(false);
    }
    setIsVideoRecordingPaused(false);
    stopVideoRecorderStream();
    setVideoRecorderOpen(false);
  };

  const startVideoRecording = () => {
    const stream = videoStreamRef.current;
    if (!stream || isVideoRecording) return;
    setVideoError(null);
    clearVideo();
    setIsVideoRecordingPaused(false);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm",
    });
    videoRecorderRef.current = mediaRecorder;
    videoChunksRef.current = [];
    setVideoRecordSeconds(0);
    videoRecordSecondsRef.current = 0;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        videoChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const duration = Math.max(1, videoRecordSecondsRef.current);
      const blob = new Blob(videoChunksRef.current, {
        type: mediaRecorder.mimeType || "video/webm",
      });
      stopVideoRecorderStream();
      setVideoRecorderOpen(false);
      if (!blob.size) {
        setVideoError("Video capture failed. Please try again.");
        return;
      }
      if (duration > maxVideoSeconds) {
        setVideoError(`Video is limited to ${maxVideoSeconds} seconds.`);
        clearVideo();
        return;
      }
      clearVideo();
      const url = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoBlobUrl(url);
      setVideoDurationSeconds(duration);
    };

    mediaRecorder.start(250);
    setIsVideoRecording(true);
    videoTimerRef.current = window.setInterval(() => {
      setVideoRecordSeconds((prev) => {
        const next = prev + 1;
        videoRecordSecondsRef.current = next;
        if (next >= maxVideoSeconds) {
          mediaRecorder.stop();
          setIsVideoRecording(false);
        }
        return next;
      });
    }, 1000);
  };

  const pauseVideoRecording = () => {
    const recorder = videoRecorderRef.current;
    if (!isVideoRecording || isVideoRecordingPaused || !recorder || recorder.state !== "recording") return;
    recorder.pause();
    setIsVideoRecordingPaused(true);
    if (videoTimerRef.current) {
      window.clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  };

  const resumeVideoRecording = () => {
    const recorder = videoRecorderRef.current;
    if (!isVideoRecording || !isVideoRecordingPaused || !recorder || recorder.state !== "paused") return;
    recorder.resume();
    setIsVideoRecordingPaused(false);
    if (videoTimerRef.current) {
      window.clearInterval(videoTimerRef.current);
    }
    videoTimerRef.current = window.setInterval(() => {
      setVideoRecordSeconds((prev) => {
        const next = prev + 1;
        videoRecordSecondsRef.current = next;
        if (next >= maxVideoSeconds) {
          recorder.stop();
          setIsVideoRecording(false);
          setIsVideoRecordingPaused(false);
        }
        return next;
      });
    }, 1000);
  };

  const stopVideoRecording = () => {
    if (!isVideoRecording) return;
    setIsVideoRecording(false);
    setIsVideoRecordingPaused(false);
    if (videoTimerRef.current) {
      window.clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    videoRecorderRef.current?.stop();
  };

  return (
    <div
      className="relative border-t border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        const target = event.relatedTarget as Node | null;
        if (target && event.currentTarget.contains(target)) return;
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      {replyTo && !hasForwardMode && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
          <div className="min-w-0">
            <div className="text-xs text-sky-300">Replying to {replyTo.senderName}</div>
            <div className="truncate">{getReplySnippet(replyTo)}</div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-lg p-1 text-sky-100/80 hover:bg-white/10"
            aria-label="Cancel reply"
          >
            <BsX size={16} />
          </button>
        </div>
      )}

      {hasForwardMode && (
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-xs text-amber-300">Forwarding {forwardMessages!.length} message(s)</div>
            <button
              type="button"
              onClick={onCancelForward}
              className="rounded-lg p-1 text-amber-100/80 hover:bg-white/10"
              aria-label="Cancel forward"
            >
              <BsX size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {forwardMessages!.slice(0, 4).map((item) => (
              <div key={item.id} className="truncate rounded-lg bg-black/20 px-2 py-1 text-xs">
                {getForwardSnippet(item)}
              </div>
            ))}
          </div>
        </div>
      )}

      {dragActive && (
        <div className="absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-sky-400 bg-sky-500/10 text-sm font-medium text-sky-100">
          Drop files to send
        </div>
      )}

      <AnimatePresence>
        {(files.length > 0 || voiceBlob || videoBlob) && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { duration: 0.18, ease: "easeOut" } }}
            exit={{ y: 16, opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
            style={optimizedMotionStyle}
            className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
          {previews.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="relative rounded-xl border border-zinc-800 bg-zinc-900/70 p-2">
              <div className="truncate text-xs text-zinc-300">{item.file.name}</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {(item.file.size / (1024 * 1024)).toFixed(2)}MB
              </div>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-zinc-100"
                aria-label="Remove file"
              >
                <BsX size={11} />
              </button>
            </div>
          ))}
          {voiceBlob && (
            <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/70 p-2">
              <div className="text-xs text-zinc-300">Voice message</div>
              <div className="mt-1 text-[11px] text-zinc-500">{formatTimer(voiceDurationSeconds ?? 0)}</div>
              {voiceBlobUrl && (
                <audio controls className="mt-2 w-full">
                  <source src={voiceBlobUrl} />
                </audio>
              )}
              <button
                type="button"
                onClick={clearVoice}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-zinc-100"
                aria-label="Remove voice message"
              >
                <BsX size={11} />
              </button>
            </div>
          )}
          {videoBlob && (
            <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/70 p-2">
              <div className="text-xs text-zinc-300">Video clip</div>
              <div className="mt-1 text-[11px] text-zinc-500">{formatTimer(videoDurationSeconds ?? 0)}</div>
              {videoBlobUrl && (
                <video controls className="mt-2 max-h-40 w-full rounded-lg bg-black">
                  <source src={videoBlobUrl} />
                </video>
              )}
              <button
                type="button"
                onClick={clearVideo}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-zinc-100"
                aria-label="Remove video clip"
              >
                <BsX size={11} />
              </button>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={actionMenuRef} className="relative">
        <div className="flex items-center gap-2 rounded-3xl border border-zinc-800/90 bg-zinc-900/70 p-2 shadow-[0_10px_35px_rgba(14,165,233,0.12)]">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen((prev) => !prev)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 transition hover:border-sky-500/50 hover:text-white"
              title="More actions"
            >
              <BsPlusLg size={15} />
            </button>
            <AnimatePresence>
              {actionsOpen && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { duration: 0.18, ease: "easeOut" } }}
                exit={{ y: 16, opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
                style={optimizedMotionStyle}
                className="absolute bottom-14 left-0 z-30 w-44 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setEmojiOpen((prev) => !prev);
                    setActionsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-white/10"
                >
                  <BsEmojiSmile size={14} />
                  Emoji
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGifOpen((prev) => !prev);
                    setGifRateLimited(false);
                    setActionsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-white/10"
                >
                  <BsImages size={14} />
                  GIF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenAttachment();
                    setActionsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-white/10"
                >
                  <BsPaperclip size={14} />
                  Attachment
                </button>
              </motion.div>
              )}
            </AnimatePresence>
          </div>

          <input
            ref={fileInputRef}
            hidden
            type="file"
            multiple
            onChange={(event) => addFiles(event.target.files)}
          />

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => handleTextChange(event.target.value)}
              rows={1}
              placeholder={hasForwardMode ? "Forward ready to send" : "Type a message"}
              className="min-h-[44px] max-h-40 w-full resize-none rounded-2xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-[10px] leading-5 text-white outline-none transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20"
              disabled={hasForwardMode}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;

                if (enterToSend) {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                  return;
                }

                if (event.ctrlKey || event.metaKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
          </div>

          <div className="relative">
          <motion.button
            type="button"
            onClick={() => {
              if (hasSendPayload) {
                void handleSend();
                return;
              }
              setMediaPickerOpen((prev) => !prev);
            }}
            disabled={isSending}
            animate={{ scale: hasSendPayload || isRecording ? 1 : 0.95, opacity: isSending ? 0.9 : 1 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={optimizedMotionStyle}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white transition disabled:opacity-40 ${
              hasSendPayload
                ? "bg-gradient-to-br from-sky-500 to-blue-600 hover:opacity-90"
                : isRecording
                ? "bg-rose-600"
                : mediaPickerOpen
                ? "bg-gradient-to-br from-cyan-500 to-blue-600 hover:opacity-90"
                : "bg-gradient-to-br from-emerald-500 to-teal-600 hover:opacity-90"
            }`}
            title={hasSendPayload ? "Send" : "Open media options"}
          >
            {isSending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : hasSendPayload ? (
              <BsFillSendFill size={15} />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mediaPickerOpen ? "media-open" : emptyActionHint}
                  initial={{ opacity: 0, y: 6, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.92 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  {mediaPickerOpen || emptyActionHint === "media" ? (
                    <BsCameraVideo size={16} />
                  ) : (
                    <BsMic size={16} />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </motion.button>
          <AnimatePresence>
            {!hasSendPayload && mediaPickerOpen && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
                exit={{ y: 8, opacity: 0, transition: { duration: 0.14, ease: "easeInOut" } }}
                style={optimizedMotionStyle}
                className="absolute bottom-14 right-0 z-30 w-44 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMediaPickerOpen(false);
                    void startRecording();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-white/10"
                >
                  <BsMic size={14} />
                  Voice message
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void openVideoRecorder();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-white/10"
                >
                  <BsCameraVideo size={14} />
                  Video clip
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {emojiOpen && (
          <motion.div
            variants={fadeScaleVariant}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={optimizedMotionStyle}
            className="absolute bottom-16 left-0 z-30 w-[280px] rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl"
          >
            <input
              value={emojiSearch}
              onChange={(event) => setEmojiSearch(event.target.value)}
              placeholder="Search emoji"
              className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/60"
            />
            {recentEmoji.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-[11px] uppercase text-zinc-500">Recent</div>
                <div className="flex flex-wrap gap-1">
                  {recentEmoji.slice(0, 8).map((emoji) => (
                    <button
                      key={`recent-${emoji}`}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="rounded-md p-1 text-lg transition hover:scale-110 hover:bg-white/10"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {Object.entries(filteredEmojiGroups).map(([group, values]) => (
                <div key={group}>
                  <div className="mb-1 text-[11px] uppercase text-zinc-500">{group}</div>
                  <div className="flex flex-wrap gap-1">
                    {values.map((emoji: string) => (
                      <button
                        key={`${group}-${emoji}`}
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                        className="rounded-md p-1 text-lg transition hover:scale-110 hover:bg-white/10"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(recordError || videoError || gifRateLimited || sendError) && (
        <div className="mt-2 text-xs text-rose-300">
          {sendError ?? recordError ?? videoError ?? "GIF rate limit exceeded. Try again in one minute."}
        </div>
      )}

      {isBrowser
        ? createPortal(
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 p-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
                  exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
                >
                  <motion.div
                    variants={fadeScaleVariant}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={optimizedMotionStyle}
                    className="mx-auto mt-6 w-full max-w-sm rounded-3xl border border-rose-400/20 bg-zinc-950/95 p-5 shadow-2xl sm:mt-10"
                  >
                    <div className="mb-4 text-center">
                      <div className="text-sm font-medium text-white">Recording voice message</div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {isRecordingPaused ? `Paused at ${formatTimer(recordSeconds)}` : formatTimer(recordSeconds)}
                      </div>
                    </div>

                    <div className="mb-5 flex flex-col items-center">
                      <div className="relative flex h-28 w-28 items-center justify-center">
                        <motion.span
                          className="absolute h-28 w-28 rounded-full bg-rose-500/15"
                          animate={
                            isRecordingPaused
                              ? { scale: 1, opacity: 0.28 }
                              : { scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.8, 0.35] }
                          }
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.span
                          className="absolute h-20 w-20 rounded-full border border-rose-300/35"
                          animate={
                            isRecordingPaused
                              ? { scale: 1, opacity: 0.4 }
                              : { scale: [0.9, 1.12, 0.9], opacity: [0.45, 0.9, 0.45] }
                          }
                          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                        />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_10px_30px_rgba(244,63,94,0.35)]">
                          <BsMic size={26} />
                        </div>
                      </div>

                      <div className="mt-5 flex h-10 items-end justify-center gap-1.5">
                        {[16, 26, 36, 24, 14].map((height, index) => (
                          <motion.span
                            key={`voice-wave-${index}`}
                            className="block w-1.5 rounded-full bg-gradient-to-t from-rose-500 to-pink-300"
                            animate={
                              isRecordingPaused
                                ? { height: 10, opacity: 0.35 }
                                : {
                                    height: [Math.max(10, height * 0.45), height, Math.max(12, height * 0.6)],
                                    opacity: [0.45, 1, 0.6],
                                  }
                            }
                            transition={{
                              duration: 0.9,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: index * 0.08,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-400">
                        {isRecordingPaused ? "Mic paused" : "Mic is active"}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:border-zinc-500"
                        >
                          {isRecordingPaused ? "Resume" : "Pause"}
                        </button>
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
              {videoRecorderOpen && (
                <motion.div
                  className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 p-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
                  exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
                >
                  <motion.div
                    variants={fadeScaleVariant}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={optimizedMotionStyle}
                    className="mx-auto mt-4 w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl sm:mt-10"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">Record video</div>
                        <div className="text-xs text-zinc-400">
                          {isVideoRecording
                            ? isVideoRecordingPaused
                              ? `Paused at ${formatTimer(videoRecordSeconds)}`
                              : `Recording ${formatTimer(videoRecordSeconds)}`
                            : "Start when you're ready"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={closeVideoRecorder}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                      >
                        Close
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
                      <video
                        ref={videoPreviewRef}
                        muted
                        playsInline
                        className="max-h-[45vh] min-h-[220px] w-full object-cover sm:max-h-[52vh]"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-xs text-zinc-400">Max {maxVideoSeconds}s</div>
                      <div className="flex items-center gap-2">
                        {isVideoRecording ? (
                          <>
                            <button
                              type="button"
                              onClick={isVideoRecordingPaused ? resumeVideoRecording : pauseVideoRecording}
                              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:border-zinc-500"
                            >
                              {isVideoRecordingPaused ? "Resume" : "Pause"}
                            </button>
                            <button
                              type="button"
                              onClick={stopVideoRecording}
                              className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
                            >
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={startVideoRecording}
                            className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                          >
                            Start recording
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}

      <AnimatePresence>
        {gifOpen && (
          <motion.div
            className="absolute inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
          >
          <motion.div
            variants={fadeScaleVariant}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={optimizedMotionStyle}
            className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-100">GIF picker</div>
              <button
                type="button"
                onClick={() => setGifOpen(false)}
                className="rounded-md p-1 text-zinc-300 hover:bg-white/10"
              >
                <BsX size={16} />
              </button>
            </div>
            <input
              value={gifSearch}
              onChange={(event) => setGifSearch(event.target.value)}
              placeholder="Search GIF URL"
              className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/60"
            />
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {filteredGifUrls.map((gifUrl) => (
                <button
                  key={gifUrl}
                  type="button"
                  onClick={() => handleGifSend(gifUrl)}
                  className="group overflow-hidden rounded-xl border border-zinc-800"
                >
                  <img
                    src={gifUrl}
                    alt="GIF"
                    className="h-24 w-full object-cover transition duration-150 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              GIF sends are limited to 10 per minute per user.
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
