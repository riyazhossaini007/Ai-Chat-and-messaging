"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateMediaSizeBytes = exports.inferMediaKind = void 0;
const client_1 = require("@prisma/client");
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|webm)(\?.*)?$/i;
const clampInt = (value) => {
    const next = Number.isFinite(value) ? Math.round(value) : 0;
    if (next < 0)
        return 0;
    if (next > 2147483647)
        return 2147483647;
    return next;
};
const getDataUrlSizeBytes = (url) => {
    if (!url.startsWith("data:"))
        return 0;
    const commaIndex = url.indexOf(",");
    if (commaIndex === -1)
        return 0;
    const metadata = url.slice(0, commaIndex);
    const payload = url.slice(commaIndex + 1);
    if (!payload)
        return 0;
    if (metadata.includes(";base64")) {
        const withoutPadding = payload.replace(/=+$/, "");
        return clampInt(Math.floor((withoutPadding.length * 3) / 4));
    }
    try {
        return clampInt(new TextEncoder().encode(decodeURIComponent(payload)).length);
    }
    catch {
        return clampInt(payload.length);
    }
};
const inferFileMediaKind = (url) => {
    if (url.startsWith("data:audio/"))
        return client_1.MediaKind.AUDIO;
    if (AUDIO_EXT_RE.test(url))
        return client_1.MediaKind.AUDIO;
    return client_1.MediaKind.DOCUMENT;
};
const inferMediaKind = (type, mediaUrl) => {
    if (type === client_1.MessageType.IMAGE)
        return client_1.MediaKind.IMAGE;
    if (type === client_1.MessageType.VIDEO)
        return client_1.MediaKind.VIDEO;
    return inferFileMediaKind(mediaUrl);
};
exports.inferMediaKind = inferMediaKind;
const estimateMediaSizeBytes = (mediaUrl) => {
    return getDataUrlSizeBytes(mediaUrl);
};
exports.estimateMediaSizeBytes = estimateMediaSizeBytes;
