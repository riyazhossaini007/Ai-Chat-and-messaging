"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const ALLOWED_LANGUAGES = ["en"];
const ALLOWED_TIME_ZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Asia/Kolkata",
];
const ALLOWED_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
const ALLOWED_AUDIENCES = ["everyone", "contacts", "nobody"];
const DEFAULT_SETTINGS = {
    language: "en",
    timeZone: "America/New_York",
    dateFormat: client_1.DateFormat.MDY,
    autoStart: false,
    allowMessagesFromNonContacts: true,
    lastSeenAudience: client_1.PrivacyAudience.CONTACTS,
    profilePhotoAudience: client_1.PrivacyAudience.EVERYONE,
    readReceiptsEnabled: true,
    twoFactorState: client_1.TwoFactorState.OFF,
    enterToSend: true,
    autoDownload: true,
    mediaQuality: 70,
};
const formatApiDateToDb = (value) => {
    if (value === "MM/DD/YYYY")
        return client_1.DateFormat.MDY;
    if (value === "DD/MM/YYYY")
        return client_1.DateFormat.DMY;
    return client_1.DateFormat.YMD;
};
const formatDbDateToApi = (value) => {
    if (value === client_1.DateFormat.MDY)
        return "MM/DD/YYYY";
    if (value === client_1.DateFormat.DMY)
        return "DD/MM/YYYY";
    return "YYYY-MM-DD";
};
const audienceApiToDb = (value) => {
    if (value === "everyone")
        return client_1.PrivacyAudience.EVERYONE;
    if (value === "contacts")
        return client_1.PrivacyAudience.CONTACTS;
    return client_1.PrivacyAudience.NOBODY;
};
const audienceDbToApi = (value) => {
    if (value === client_1.PrivacyAudience.EVERYONE)
        return "everyone";
    if (value === client_1.PrivacyAudience.CONTACTS)
        return "contacts";
    return "nobody";
};
const toApiSettings = (settings) => ({
    id: settings.id,
    userId: settings.userId,
    language: settings.language,
    timeZone: settings.timeZone,
    dateFormat: formatDbDateToApi(settings.dateFormat),
    autoStart: settings.autoStart,
    allowMessagesFromNonContacts: settings.allowMessagesFromNonContacts,
    lastSeen: audienceDbToApi(settings.lastSeenAudience),
    profilePhoto: audienceDbToApi(settings.profilePhotoAudience),
    readReceipts: settings.readReceiptsEnabled,
    twoFactor: {
        state: settings.twoFactorState,
    },
    chat: {
        enterToSend: settings.enterToSend,
        autoDownload: settings.autoDownload,
        mediaQuality: settings.mediaQuality,
    },
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
});
const ensureAllowedKeys = (input) => {
    const allowed = new Set([
        "language",
        "timeZone",
        "dateFormat",
        "autoStart",
        "allowMessagesFromNonContacts",
        "lastSeen",
        "profilePhoto",
        "readReceipts",
        "twoFactorEnabled",
        "chat",
    ]);
    const unknownKeys = Object.keys(input).filter((key) => !allowed.has(key));
    if (unknownKeys.length > 0) {
        throw new errorHandler_1.AppError(400, `Unknown settings fields: ${unknownKeys.join(", ")}`);
    }
};
const validatePatch = (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new errorHandler_1.AppError(400, "Invalid settings payload");
    }
    const raw = input;
    ensureAllowedKeys(raw);
    const patch = {};
    if ("language" in raw) {
        if (typeof raw.language !== "string" || !ALLOWED_LANGUAGES.includes(raw.language)) {
            throw new errorHandler_1.AppError(400, `language must be one of: ${ALLOWED_LANGUAGES.join(", ")}`);
        }
        patch.language = raw.language;
    }
    if ("timeZone" in raw) {
        if (typeof raw.timeZone !== "string" ||
            !ALLOWED_TIME_ZONES.includes(raw.timeZone)) {
            throw new errorHandler_1.AppError(400, `timeZone must be one of: ${ALLOWED_TIME_ZONES.join(", ")}`);
        }
        patch.timeZone = raw.timeZone;
    }
    if ("dateFormat" in raw) {
        if (typeof raw.dateFormat !== "string" ||
            !ALLOWED_DATE_FORMATS.includes(raw.dateFormat)) {
            throw new errorHandler_1.AppError(400, `dateFormat must be one of: ${ALLOWED_DATE_FORMATS.join(", ")}`);
        }
        patch.dateFormat = raw.dateFormat;
    }
    if ("autoStart" in raw) {
        if (typeof raw.autoStart !== "boolean") {
            throw new errorHandler_1.AppError(400, "autoStart must be a boolean");
        }
        patch.autoStart = raw.autoStart;
    }
    if ("allowMessagesFromNonContacts" in raw) {
        if (typeof raw.allowMessagesFromNonContacts !== "boolean") {
            throw new errorHandler_1.AppError(400, "allowMessagesFromNonContacts must be a boolean");
        }
        patch.allowMessagesFromNonContacts = raw.allowMessagesFromNonContacts;
    }
    if ("lastSeen" in raw) {
        if (typeof raw.lastSeen !== "string" ||
            !ALLOWED_AUDIENCES.includes(raw.lastSeen)) {
            throw new errorHandler_1.AppError(400, `lastSeen must be one of: ${ALLOWED_AUDIENCES.join(", ")}`);
        }
        patch.lastSeen = raw.lastSeen;
    }
    if ("profilePhoto" in raw) {
        if (typeof raw.profilePhoto !== "string" ||
            !ALLOWED_AUDIENCES.includes(raw.profilePhoto)) {
            throw new errorHandler_1.AppError(400, `profilePhoto must be one of: ${ALLOWED_AUDIENCES.join(", ")}`);
        }
        patch.profilePhoto = raw.profilePhoto;
    }
    if ("readReceipts" in raw) {
        if (typeof raw.readReceipts !== "boolean") {
            throw new errorHandler_1.AppError(400, "readReceipts must be a boolean");
        }
        patch.readReceipts = raw.readReceipts;
    }
    if ("twoFactorEnabled" in raw) {
        if (typeof raw.twoFactorEnabled !== "boolean") {
            throw new errorHandler_1.AppError(400, "twoFactorEnabled must be a boolean");
        }
        patch.twoFactorEnabled = raw.twoFactorEnabled;
    }
    if ("chat" in raw) {
        if (!raw.chat || typeof raw.chat !== "object" || Array.isArray(raw.chat)) {
            throw new errorHandler_1.AppError(400, "chat must be an object");
        }
        const chatRaw = raw.chat;
        const allowedChatKeys = new Set(["enterToSend", "autoDownload", "mediaQuality"]);
        const unknownChatKeys = Object.keys(chatRaw).filter((key) => !allowedChatKeys.has(key));
        if (unknownChatKeys.length > 0) {
            throw new errorHandler_1.AppError(400, `Unknown chat settings fields: ${unknownChatKeys.join(", ")}`);
        }
        const chatPatch = {};
        if ("enterToSend" in chatRaw) {
            if (typeof chatRaw.enterToSend !== "boolean") {
                throw new errorHandler_1.AppError(400, "chat.enterToSend must be a boolean");
            }
            chatPatch.enterToSend = chatRaw.enterToSend;
        }
        if ("autoDownload" in chatRaw) {
            if (typeof chatRaw.autoDownload !== "boolean") {
                throw new errorHandler_1.AppError(400, "chat.autoDownload must be a boolean");
            }
            chatPatch.autoDownload = chatRaw.autoDownload;
        }
        if ("mediaQuality" in chatRaw) {
            if (typeof chatRaw.mediaQuality !== "number" ||
                !Number.isInteger(chatRaw.mediaQuality) ||
                chatRaw.mediaQuality < 10 ||
                chatRaw.mediaQuality > 100) {
                throw new errorHandler_1.AppError(400, "chat.mediaQuality must be an integer between 10 and 100");
            }
            chatPatch.mediaQuality = chatRaw.mediaQuality;
        }
        patch.chat = chatPatch;
    }
    return patch;
};
const getOrCreateSettings = async (userId) => {
    const settings = await prisma_1.prisma.userSettings.upsert({
        where: { userId },
        update: {},
        create: {
            userId,
            ...DEFAULT_SETTINGS,
        },
    });
    return toApiSettings(settings);
};
const updateSettings = async (userId, input) => {
    const patch = validatePatch(input);
    const current = await prisma_1.prisma.userSettings.upsert({
        where: { userId },
        update: {},
        create: {
            userId,
            ...DEFAULT_SETTINGS,
        },
        select: {
            twoFactorState: true,
        },
    });
    const nextTwoFactorState = patch.twoFactorEnabled === undefined
        ? undefined
        : patch.twoFactorEnabled
            ? current.twoFactorState === client_1.TwoFactorState.OFF
                ? client_1.TwoFactorState.SETUP_REQUIRED
                : current.twoFactorState
            : client_1.TwoFactorState.OFF;
    const settings = await prisma_1.prisma.userSettings.upsert({
        where: { userId },
        update: {
            ...(patch.language !== undefined ? { language: patch.language } : {}),
            ...(patch.timeZone !== undefined ? { timeZone: patch.timeZone } : {}),
            ...(patch.dateFormat !== undefined ? { dateFormat: formatApiDateToDb(patch.dateFormat) } : {}),
            ...(patch.autoStart !== undefined ? { autoStart: patch.autoStart } : {}),
            ...(patch.allowMessagesFromNonContacts !== undefined
                ? { allowMessagesFromNonContacts: patch.allowMessagesFromNonContacts }
                : {}),
            ...(patch.lastSeen !== undefined
                ? { lastSeenAudience: audienceApiToDb(patch.lastSeen) }
                : {}),
            ...(patch.profilePhoto !== undefined
                ? { profilePhotoAudience: audienceApiToDb(patch.profilePhoto) }
                : {}),
            ...(patch.readReceipts !== undefined
                ? { readReceiptsEnabled: patch.readReceipts }
                : {}),
            ...(nextTwoFactorState !== undefined ? { twoFactorState: nextTwoFactorState } : {}),
            ...(patch.chat?.enterToSend !== undefined ? { enterToSend: patch.chat.enterToSend } : {}),
            ...(patch.chat?.autoDownload !== undefined ? { autoDownload: patch.chat.autoDownload } : {}),
            ...(patch.chat?.mediaQuality !== undefined ? { mediaQuality: patch.chat.mediaQuality } : {}),
        },
        create: {
            userId,
            ...DEFAULT_SETTINGS,
            ...(patch.language !== undefined ? { language: patch.language } : {}),
            ...(patch.timeZone !== undefined ? { timeZone: patch.timeZone } : {}),
            ...(patch.dateFormat !== undefined ? { dateFormat: formatApiDateToDb(patch.dateFormat) } : {}),
            ...(patch.autoStart !== undefined ? { autoStart: patch.autoStart } : {}),
            ...(patch.allowMessagesFromNonContacts !== undefined
                ? { allowMessagesFromNonContacts: patch.allowMessagesFromNonContacts }
                : {}),
            ...(patch.lastSeen !== undefined
                ? { lastSeenAudience: audienceApiToDb(patch.lastSeen) }
                : {}),
            ...(patch.profilePhoto !== undefined
                ? { profilePhotoAudience: audienceApiToDb(patch.profilePhoto) }
                : {}),
            ...(patch.readReceipts !== undefined
                ? { readReceiptsEnabled: patch.readReceipts }
                : {}),
            ...(nextTwoFactorState !== undefined ? { twoFactorState: nextTwoFactorState } : {}),
            ...(patch.chat?.enterToSend !== undefined ? { enterToSend: patch.chat.enterToSend } : {}),
            ...(patch.chat?.autoDownload !== undefined ? { autoDownload: patch.chat.autoDownload } : {}),
            ...(patch.chat?.mediaQuality !== undefined ? { mediaQuality: patch.chat.mediaQuality } : {}),
        },
    });
    return toApiSettings(settings);
};
const validateAvatarRequest = (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new errorHandler_1.AppError(400, "Invalid avatar request payload");
    }
    const raw = input;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const useCase = typeof raw.useCase === "string" ? raw.useCase.trim() : "";
    const tone = typeof raw.tone === "string" ? raw.tone.trim() : "";
    if (name.length < 2 || name.length > 40) {
        throw new errorHandler_1.AppError(400, "name must be between 2 and 40 characters");
    }
    if (useCase.length < 8 || useCase.length > 240) {
        throw new errorHandler_1.AppError(400, "useCase must be between 8 and 240 characters");
    }
    if (tone.length < 2 || tone.length > 40) {
        throw new errorHandler_1.AppError(400, "tone must be between 2 and 40 characters");
    }
    return { name, useCase, tone };
};
const createAvatarRequest = async (userId, input) => {
    const parsed = validateAvatarRequest(input);
    const jobId = `avatar-request-${(0, crypto_1.randomUUID)()}`;
    await prisma_1.prisma.backgroundJob.create({
        data: {
            jobId,
            type: "avatar_request",
            userId,
            status: client_1.BackgroundJobStatus.SUCCESS,
            completedAt: new Date(),
            scheduledAt: new Date(),
            nextRunAt: new Date(),
            attempts: 0,
            maxAttempts: 1,
            payload: {
                ...parsed,
                source: "ai_avatar_empty_state",
                submittedAt: new Date().toISOString(),
            },
        },
    });
    return { jobId };
};
exports.settingsService = {
    getOrCreateSettings,
    updateSettings,
    createAvatarRequest,
};
