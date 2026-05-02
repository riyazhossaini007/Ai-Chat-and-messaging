import type { AiMessage } from "../components/AIChatComponents/AItypes";

export type StoredAiSession = {
  id: string;
  title: string;
  updatedAt: string;
  pinned?: boolean;
  messages: AiMessage[];
};

const STORAGE_KEY = "plaxeai_ai_sessions";
const PENDING_DRAFTS_KEY = "plaxeai_ai_pending_drafts";
const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidAiSessionId = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === "ai" || trimmed === "/ai") return false;
  return UUID_LIKE_PATTERN.test(trimmed);
};

const readSessions = (): StoredAiSession[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredAiSession[];
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed.filter((item) => isValidAiSessionId(item?.id));
    if (sanitized.length !== parsed.length) {
      writeSessions(sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
};

const writeSessions = (sessions: StoredAiSession[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

const readPendingDrafts = (): Record<string, string> => {
  const raw = localStorage.getItem(PENDING_DRAFTS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isValidAiSessionId(key)) continue;
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      next[key] = trimmed;
    }
    return next;
  } catch {
    return {};
  }
};

const writePendingDrafts = (drafts: Record<string, string>) => {
  localStorage.setItem(PENDING_DRAFTS_KEY, JSON.stringify(drafts));
};

export const getAiSessions = () => {
  return readSessions().sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};

export const getAiSessionById = (id: string) => {
  if (!isValidAiSessionId(id)) return null;
  return readSessions().find((session) => session.id === id) ?? null;
};

export const upsertAiSession = (payload: StoredAiSession) => {
  if (!isValidAiSessionId(payload.id)) return;
  const existing = readSessions();
  const existingMatch = existing.find((session) => session.id === payload.id);
  const next = [
    { ...payload, pinned: existingMatch?.pinned ?? payload.pinned ?? false },
    ...existing.filter((session) => session.id !== payload.id),
  ].slice(0, 100);
  writeSessions(next);
};

export const togglePinAiSession = (id: string) => {
  const sessions = readSessions();
  const next = sessions.map((session) =>
    session.id === id
      ? { ...session, pinned: !session.pinned, updatedAt: new Date().toISOString() }
      : session
  );
  writeSessions(next);
};

export const deleteAiSession = (id: string) => {
  const sessions = readSessions();
  writeSessions(sessions.filter((session) => session.id !== id));
};

export const renameAiSession = (id: string, title: string) => {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;
  const sessions = readSessions();
  const next = sessions.map((session) =>
    session.id === id
      ? { ...session, title: trimmedTitle, updatedAt: new Date().toISOString() }
      : session
  );
  writeSessions(next);
};

export const setPendingAiDraft = (id: string, message: string) => {
  if (!isValidAiSessionId(id)) return;
  const trimmed = message.trim();
  if (!trimmed) return;
  const drafts = readPendingDrafts();
  drafts[id] = trimmed;
  writePendingDrafts(drafts);
};

export const getPendingAiDraft = (id: string) => {
  if (!isValidAiSessionId(id)) return "";
  const drafts = readPendingDrafts();
  return drafts[id] ?? "";
};

export const clearPendingAiDraft = (id: string) => {
  if (!isValidAiSessionId(id)) return;
  const drafts = readPendingDrafts();
  if (!(id in drafts)) return;
  delete drafts[id];
  writePendingDrafts(drafts);
};
