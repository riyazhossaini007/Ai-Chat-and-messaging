import { BackgroundJobStatus, DateFormat, PrivacyAudience, TwoFactorState } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";

const ALLOWED_LANGUAGES = ["en"] as const;
const ALLOWED_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
] as const;
const ALLOWED_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

type ApiDateFormat = (typeof ALLOWED_DATE_FORMATS)[number];
const ALLOWED_AUDIENCES = ["everyone", "contacts", "nobody"] as const;
type ApiAudience = (typeof ALLOWED_AUDIENCES)[number];

type SettingsPatchInput = {
  language?: string;
  timeZone?: string;
  dateFormat?: ApiDateFormat;
  autoStart?: boolean;
  allowMessagesFromNonContacts?: boolean;
  lastSeen?: ApiAudience;
  profilePhoto?: ApiAudience;
  readReceipts?: boolean;
  twoFactorEnabled?: boolean;
  chat?: {
    enterToSend?: boolean;
    autoDownload?: boolean;
    mediaQuality?: number;
  };
};

type AvatarRequestInput = {
  name: string;
  useCase: string;
  tone: string;
};

const DEFAULT_SETTINGS = {
  language: "en",
  timeZone: "America/New_York",
  dateFormat: DateFormat.MDY,
  autoStart: false,
  allowMessagesFromNonContacts: true,
  lastSeenAudience: PrivacyAudience.CONTACTS,
  profilePhotoAudience: PrivacyAudience.EVERYONE,
  readReceiptsEnabled: true,
  twoFactorState: TwoFactorState.OFF,
  enterToSend: true,
  autoDownload: true,
  mediaQuality: 70,
} as const;

const formatApiDateToDb = (value: ApiDateFormat): DateFormat => {
  if (value === "MM/DD/YYYY") return DateFormat.MDY;
  if (value === "DD/MM/YYYY") return DateFormat.DMY;
  return DateFormat.YMD;
};

const formatDbDateToApi = (value: DateFormat): ApiDateFormat => {
  if (value === DateFormat.MDY) return "MM/DD/YYYY";
  if (value === DateFormat.DMY) return "DD/MM/YYYY";
  return "YYYY-MM-DD";
};

const audienceApiToDb = (value: ApiAudience): PrivacyAudience => {
  if (value === "everyone") return PrivacyAudience.EVERYONE;
  if (value === "contacts") return PrivacyAudience.CONTACTS;
  return PrivacyAudience.NOBODY;
};

const audienceDbToApi = (value: PrivacyAudience): ApiAudience => {
  if (value === PrivacyAudience.EVERYONE) return "everyone";
  if (value === PrivacyAudience.CONTACTS) return "contacts";
  return "nobody";
};

const toApiSettings = (settings: {
  id: string;
  userId: string;
  language: string;
  timeZone: string;
  dateFormat: DateFormat;
  autoStart: boolean;
  allowMessagesFromNonContacts: boolean;
  lastSeenAudience: PrivacyAudience;
  profilePhotoAudience: PrivacyAudience;
  readReceiptsEnabled: boolean;
  twoFactorState: TwoFactorState;
  enterToSend: boolean;
  autoDownload: boolean;
  mediaQuality: number;
  createdAt: Date;
  updatedAt: Date;
}) => ({
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

const ensureAllowedKeys = (input: Record<string, unknown>) => {
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
    throw new AppError(400, `Unknown settings fields: ${unknownKeys.join(", ")}`);
  }
};

const validatePatch = (input: unknown): SettingsPatchInput => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError(400, "Invalid settings payload");
  }

  const raw = input as Record<string, unknown>;
  ensureAllowedKeys(raw);

  const patch: SettingsPatchInput = {};

  if ("language" in raw) {
    if (typeof raw.language !== "string" || !ALLOWED_LANGUAGES.includes(raw.language as "en")) {
      throw new AppError(400, `language must be one of: ${ALLOWED_LANGUAGES.join(", ")}`);
    }
    patch.language = raw.language;
  }

  if ("timeZone" in raw) {
    if (
      typeof raw.timeZone !== "string" ||
      !ALLOWED_TIME_ZONES.includes(raw.timeZone as (typeof ALLOWED_TIME_ZONES)[number])
    ) {
      throw new AppError(400, `timeZone must be one of: ${ALLOWED_TIME_ZONES.join(", ")}`);
    }
    patch.timeZone = raw.timeZone;
  }

  if ("dateFormat" in raw) {
    if (
      typeof raw.dateFormat !== "string" ||
      !ALLOWED_DATE_FORMATS.includes(raw.dateFormat as ApiDateFormat)
    ) {
      throw new AppError(400, `dateFormat must be one of: ${ALLOWED_DATE_FORMATS.join(", ")}`);
    }
    patch.dateFormat = raw.dateFormat as ApiDateFormat;
  }

  if ("autoStart" in raw) {
    if (typeof raw.autoStart !== "boolean") {
      throw new AppError(400, "autoStart must be a boolean");
    }
    patch.autoStart = raw.autoStart;
  }

  if ("allowMessagesFromNonContacts" in raw) {
    if (typeof raw.allowMessagesFromNonContacts !== "boolean") {
      throw new AppError(400, "allowMessagesFromNonContacts must be a boolean");
    }
    patch.allowMessagesFromNonContacts = raw.allowMessagesFromNonContacts;
  }

  if ("lastSeen" in raw) {
    if (
      typeof raw.lastSeen !== "string" ||
      !ALLOWED_AUDIENCES.includes(raw.lastSeen as ApiAudience)
    ) {
      throw new AppError(400, `lastSeen must be one of: ${ALLOWED_AUDIENCES.join(", ")}`);
    }
    patch.lastSeen = raw.lastSeen as ApiAudience;
  }

  if ("profilePhoto" in raw) {
    if (
      typeof raw.profilePhoto !== "string" ||
      !ALLOWED_AUDIENCES.includes(raw.profilePhoto as ApiAudience)
    ) {
      throw new AppError(400, `profilePhoto must be one of: ${ALLOWED_AUDIENCES.join(", ")}`);
    }
    patch.profilePhoto = raw.profilePhoto as ApiAudience;
  }

  if ("readReceipts" in raw) {
    if (typeof raw.readReceipts !== "boolean") {
      throw new AppError(400, "readReceipts must be a boolean");
    }
    patch.readReceipts = raw.readReceipts;
  }

  if ("twoFactorEnabled" in raw) {
    if (typeof raw.twoFactorEnabled !== "boolean") {
      throw new AppError(400, "twoFactorEnabled must be a boolean");
    }
    patch.twoFactorEnabled = raw.twoFactorEnabled;
  }

  if ("chat" in raw) {
    if (!raw.chat || typeof raw.chat !== "object" || Array.isArray(raw.chat)) {
      throw new AppError(400, "chat must be an object");
    }
    const chatRaw = raw.chat as Record<string, unknown>;
    const allowedChatKeys = new Set(["enterToSend", "autoDownload", "mediaQuality"]);
    const unknownChatKeys = Object.keys(chatRaw).filter((key) => !allowedChatKeys.has(key));
    if (unknownChatKeys.length > 0) {
      throw new AppError(400, `Unknown chat settings fields: ${unknownChatKeys.join(", ")}`);
    }

    const chatPatch: NonNullable<SettingsPatchInput["chat"]> = {};

    if ("enterToSend" in chatRaw) {
      if (typeof chatRaw.enterToSend !== "boolean") {
        throw new AppError(400, "chat.enterToSend must be a boolean");
      }
      chatPatch.enterToSend = chatRaw.enterToSend;
    }

    if ("autoDownload" in chatRaw) {
      if (typeof chatRaw.autoDownload !== "boolean") {
        throw new AppError(400, "chat.autoDownload must be a boolean");
      }
      chatPatch.autoDownload = chatRaw.autoDownload;
    }

    if ("mediaQuality" in chatRaw) {
      if (
        typeof chatRaw.mediaQuality !== "number" ||
        !Number.isInteger(chatRaw.mediaQuality) ||
        chatRaw.mediaQuality < 10 ||
        chatRaw.mediaQuality > 100
      ) {
        throw new AppError(400, "chat.mediaQuality must be an integer between 10 and 100");
      }
      chatPatch.mediaQuality = chatRaw.mediaQuality;
    }

    patch.chat = chatPatch;
  }

  return patch;
};

const getOrCreateSettings = async (userId: string) => {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_SETTINGS,
    },
  });

  return toApiSettings(settings);
};

const updateSettings = async (userId: string, input: unknown) => {
  const patch = validatePatch(input);
  const current = await prisma.userSettings.upsert({
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

  const nextTwoFactorState =
    patch.twoFactorEnabled === undefined
      ? undefined
      : patch.twoFactorEnabled
      ? current.twoFactorState === TwoFactorState.OFF
        ? TwoFactorState.SETUP_REQUIRED
        : current.twoFactorState
      : TwoFactorState.OFF;

  const settings = await prisma.userSettings.upsert({
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

const validateAvatarRequest = (input: unknown): AvatarRequestInput => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError(400, "Invalid avatar request payload");
  }

  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const useCase = typeof raw.useCase === "string" ? raw.useCase.trim() : "";
  const tone = typeof raw.tone === "string" ? raw.tone.trim() : "";

  if (name.length < 2 || name.length > 40) {
    throw new AppError(400, "name must be between 2 and 40 characters");
  }
  if (useCase.length < 8 || useCase.length > 240) {
    throw new AppError(400, "useCase must be between 8 and 240 characters");
  }
  if (tone.length < 2 || tone.length > 40) {
    throw new AppError(400, "tone must be between 2 and 40 characters");
  }

  return { name, useCase, tone };
};

const createAvatarRequest = async (userId: string, input: unknown) => {
  const parsed = validateAvatarRequest(input);
  const jobId = `avatar-request-${randomUUID()}`;

  await (prisma as any).backgroundJob.create({
    data: {
      jobId,
      type: "avatar_request",
      userId,
      status: BackgroundJobStatus.SUCCESS,
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

export const settingsService = {
  getOrCreateSettings,
  updateSettings,
  createAvatarRequest,
};
