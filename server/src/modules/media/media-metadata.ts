import { MediaKind, MessageType } from "@prisma/client";

const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|webm)(\?.*)?$/i;

const clampInt = (value: number) => {
  const next = Number.isFinite(value) ? Math.round(value) : 0;
  if (next < 0) return 0;
  if (next > 2_147_483_647) return 2_147_483_647;
  return next;
};

const getDataUrlSizeBytes = (url: string) => {
  if (!url.startsWith("data:")) return 0;
  const commaIndex = url.indexOf(",");
  if (commaIndex === -1) return 0;

  const metadata = url.slice(0, commaIndex);
  const payload = url.slice(commaIndex + 1);
  if (!payload) return 0;

  if (metadata.includes(";base64")) {
    const withoutPadding = payload.replace(/=+$/, "");
    return clampInt(Math.floor((withoutPadding.length * 3) / 4));
  }

  try {
    return clampInt(new TextEncoder().encode(decodeURIComponent(payload)).length);
  } catch {
    return clampInt(payload.length);
  }
};

const inferFileMediaKind = (url: string): MediaKind => {
  if (url.startsWith("data:audio/")) return MediaKind.AUDIO;
  if (AUDIO_EXT_RE.test(url)) return MediaKind.AUDIO;
  return MediaKind.DOCUMENT;
};

export const inferMediaKind = (type: MessageType, mediaUrl: string): MediaKind => {
  if (type === MessageType.IMAGE) return MediaKind.IMAGE;
  if (type === MessageType.VIDEO) return MediaKind.VIDEO;
  return inferFileMediaKind(mediaUrl);
};

export const estimateMediaSizeBytes = (mediaUrl: string) => {
  return getDataUrlSizeBytes(mediaUrl);
};

