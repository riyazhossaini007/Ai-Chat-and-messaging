import { api, getApiBaseUrl } from "./api";
import type {
  ApiEnvelope,
  ContextRespondResult,
  GroupInsightRecord,
  KnowledgeItemRecord,
  SemanticSearchResultGroup,
  UserMemoryRecord,
} from "./types";
import { getAuthToken } from "../lib/authStorage";

export type AiRole = "system" | "user" | "assistant";

export type AiChatPayload = {
  requestId?: string;
  regeneratedFromRequestId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages: Array<{
    role: AiRole;
    content: string;
  }>;
};

export type AiChatResponse = {
  id: string | null;
  provider?: string;
  model: "openrouter" | "openai" | "claude" | "gemini" | "grok";
  switchedFromModel?: "openrouter" | "openai" | "claude" | "gemini" | "grok" | null;
  switchedToModel?: "openrouter" | "openai" | "claude" | "gemini" | "grok" | null;
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export type AiModelConfigResponse = {
  provider: "multi";
  defaultModel: "openrouter" | "openai" | "claude" | "gemini" | "grok";
  defaultSelection: string;
  models: Array<"openrouter" | "openai" | "claude" | "gemini" | "grok">;
  modelLabels: Record<string, string>;
  providerVersions: Record<string, string[]>;
  allowedSelections: string[];
  modelSelections: Array<{
    id: string;
    provider: "openrouter" | "openai" | "claude" | "gemini" | "grok";
    version: string;
    label: string;
    free: boolean;
    locked: boolean;
  }>;
  subscriptionActive: boolean;
  billing: {
    subscriptionActive: boolean;
    credits: {
      totalCredits: number;
      usedCredits: number;
      remainingCredits: number;
    };
  };
};

export const createAiChatCompletion = async (payload: AiChatPayload) => {
  const response = await api.post<ApiEnvelope<{ reply: AiChatResponse }>>(
    "/ai/chat",
    payload
  );
  return response.data.data.reply;
};

export const fetchAiModelConfig = async () => {
  const response = await api.get<ApiEnvelope<AiModelConfigResponse>>("/ai/models");
  return response.data.data;
};

export const createAiChatCompletionStream = async (
  payload: AiChatPayload,
  handlers: {
    onToken: (token: string) => void;
    onDone: (reply: AiChatResponse) => void;
    onCancelled?: () => void;
  }
) => {
  const token = getAuthToken();
  const response = await fetch(`${getApiBaseUrl()}/ai/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const raw = await response.text();
    let parsedMessage = "";
    let parsedError = "";
    let retryAfterMs = 0;
    let suggestedModels: string[] = [];
    try {
      const parsed = JSON.parse(raw) as {
        message?: string;
        error?: string;
        details?:
          | string
          | {
              message?: string;
              error?: string;
              providerError?: string;
            };
        retryAfterMs?: number;
        suggestedModels?: string[];
        allowedSelections?: string[];
        defaultSelection?: string;
      };
      const detailMessage =
        typeof parsed.details === "string"
          ? parsed.details
          : parsed.details?.message ||
            parsed.details?.error ||
            parsed.details?.providerError ||
            "";
      parsedMessage = parsed.message || parsed.error || detailMessage || "";
      parsedError = parsed.error || "";
      retryAfterMs = typeof parsed.retryAfterMs === "number" ? parsed.retryAfterMs : 0;
      suggestedModels = Array.isArray(parsed.suggestedModels) ? parsed.suggestedModels : [];
    } catch {
      parsedMessage = "";
    }
    if (parsedError === "CREDITS_REQUIRED") {
      throw new Error("CREDITS_REQUIRED");
    }
    if (parsedError === "MODEL_NOT_ALLOWED") {
      throw new Error("MODEL_NOT_ALLOWED");
    }
    if (parsedError === "MODEL_COOLDOWN") {
      throw new Error(`MODEL_COOLDOWN:${retryAfterMs}`);
    }
    if (parsedError === "PROVIDER_DEGRADED") {
      throw new Error(`PROVIDER_DEGRADED:${suggestedModels.join(",")}`);
    }
    throw new Error(parsedMessage || raw || "Streaming request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let buffer = "";

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const line of lines) {
        if (!line) continue;
        const event = JSON.parse(line) as
          | { type: "start"; requestId: string }
          | { type: "chunk"; token: string }
          | { type: "done"; reply: AiChatResponse }
          | { type: "cancelled"; requestId: string }
          | {
              type: "error";
              message: string;
              error?: string;
              retryAfterMs?: number;
              suggestedModels?: string[];
            };

        if (event.type === "start") {
          continue;
        }

        if (event.type === "chunk") {
          handlers.onToken(event.token);
          continue;
        }

        if (event.type === "done") {
          handlers.onDone(event.reply);
          return;
        }

        if (event.type === "cancelled") {
          handlers.onCancelled?.();
          return;
        }

        if (event.error === "CREDITS_REQUIRED") {
          throw new Error("CREDITS_REQUIRED");
        }
        if (event.error === "MODEL_NOT_ALLOWED") {
          throw new Error("MODEL_NOT_ALLOWED");
        }
        if (event.error === "MODEL_COOLDOWN") {
          throw new Error(`MODEL_COOLDOWN:${event.retryAfterMs ?? 0}`);
        }
        if (event.error === "PROVIDER_DEGRADED") {
          throw new Error(
            `PROVIDER_DEGRADED:${Array.isArray(event.suggestedModels) ? event.suggestedModels.join(",") : ""}`
          );
        }
        throw new Error(event.message || "Streaming failed");
      }
    }
  }
};

export const cancelAiChatStream = async (requestId: string) => {
  const response = await api.post<
    ApiEnvelope<{
      requestId: string;
      status: "RUNNING" | "OK" | "ERROR" | "CANCELLED";
      cancelled: boolean;
    }>
  >(`/ai/chat/cancel/${encodeURIComponent(requestId)}`);
  return response.data.data;
};

export type AiThreadRecord = {
  id: string;
  chatId: string;
  requesterId: string;
  targetMessageId?: string | null;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiTurnRecord = {
  id: string;
  threadId: string;
  role: "USER" | "AI";
  content: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
};

export type AiThreadTargetMessage = {
  id: string;
  senderId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  content: string | null;
  unavailable?: boolean;
  attachments?: Array<{
    id: string;
    kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
    url: string;
    sizeBytes: number;
  }>;
} | null;

export const createAiThread = async (payload: {
  chatId: string;
  targetMessageId?: string;
}) => {
  const response = await api.post<
    ApiEnvelope<{
      threadId: string;
      thread: AiThreadRecord;
      turns?: AiTurnRecord[];
    }>
  >("/ai/threads", payload);
  return response.data.data;
};

export const getAiThread = async (threadId: string) => {
  const response = await api.get<
    ApiEnvelope<{
      thread: AiThreadRecord;
      turns: AiTurnRecord[];
      targetMessage: AiThreadTargetMessage;
    }>
  >(`/ai/threads/${encodeURIComponent(threadId)}`);
  return response.data.data;
};

export const createAiThreadTurn = async (
  threadId: string,
  payload: {
    prompt: string;
    commandHint?: "SUMMARIZE" | "EXPLAIN" | "TRANSLATE" | "GENERAL";
    translateTo?: string;
  }
) => {
  const response = await api.post<
    ApiEnvelope<{
      userTurn: AiTurnRecord;
      aiTurnPlaceholder: AiTurnRecord;
      jobId: string;
    }>
  >(`/ai/threads/${encodeURIComponent(threadId)}/turns`, payload);
  return response.data.data;
};

export const shareAiTurnToChat = async (threadId: string, aiTurnId: string) => {
  const response = await api.post<ApiEnvelope<{ message: unknown }>>(
    `/ai/threads/${encodeURIComponent(threadId)}/share`,
    { aiTurnId }
  );
  return response.data.data;
};

export const forwardAiTurn = async (threadId: string, payload: { aiTurnId: string; toChatId: string }) => {
  const response = await api.post<ApiEnvelope<{ message: unknown }>>(
    `/ai/threads/${encodeURIComponent(threadId)}/forward`,
    payload
  );
  return response.data.data;
};

export const extractKnowledge = async (payload: {
  chatId?: string;
  groupId?: string;
  messageIds?: string[];
  knowledgeType?:
    | "SUMMARY"
    | "TASK"
    | "DECISION"
    | "IDEA"
    | "FACT"
    | "FOLLOW_UP"
    | "MEETING_NOTE"
    | "ISSUE"
    | "RISK"
    | "MILESTONE";
  title?: string;
  summary?: string;
  saveToMemory?: boolean;
}) => {
  const response = await api.post<
    ApiEnvelope<{ knowledgeItems: KnowledgeItemRecord[]; memoryItems: UserMemoryRecord[] }>
  >("/ai/knowledge/extract", payload);
  return response.data.data;
};

export const fetchKnowledge = async (params?: {
  chatId?: string;
  groupId?: string;
  reviewState?: "PENDING" | "CONFIRMED" | "DISMISSED";
  type?:
    | "SUMMARY"
    | "TASK"
    | "DECISION"
    | "IDEA"
    | "FACT"
    | "FOLLOW_UP"
    | "MEETING_NOTE"
    | "ISSUE"
    | "RISK"
    | "MILESTONE";
  limit?: number;
}) => {
  const response = await api.get<ApiEnvelope<{ items: KnowledgeItemRecord[] }>>("/ai/knowledge", {
    params,
  });
  return response.data.data.items;
};

export const updateKnowledge = async (
  id: string,
  payload: {
    reviewState?: "PENDING" | "CONFIRMED" | "DISMISSED";
    tags?: string[];
  }
) => {
  const response = await api.patch<ApiEnvelope<{ item: KnowledgeItemRecord }>>(
    `/ai/knowledge/${encodeURIComponent(id)}`,
    payload
  );
  return response.data.data.item;
};

export const pinMemory = async (memoryId: string) => {
  const response = await api.post<ApiEnvelope<{ item: UserMemoryRecord }>>("/ai/memory/pin", {
    memoryId,
  });
  return response.data.data.item;
};

export const forgetMemory = async (payload: { memoryId?: string; topic?: string }) => {
  const response = await api.post<
    ApiEnvelope<{ updatedCount: number; items: UserMemoryRecord[] }>
  >("/ai/memory/forget", payload);
  return response.data.data;
};

export const searchMemory = async (params: {
  q?: string;
  pinned?: boolean;
  recent?: boolean;
  topic?: string;
  from?: string;
  to?: string;
  limit?: number;
}) => {
  const response = await api.get<ApiEnvelope<{ items: UserMemoryRecord[] }>>("/ai/memory/search", {
    params,
  });
  return response.data.data.items;
};

export const fetchGroupInsights = async (groupId: string, limit = 10) => {
  const response = await api.get<ApiEnvelope<{ items: GroupInsightRecord[] }>>(
    `/ai/groups/${encodeURIComponent(groupId)}/insights`,
    { params: { limit } }
  );
  return response.data.data.items;
};

export const fetchGroupDecisions = async (groupId: string, limit = 10) => {
  const response = await api.get<ApiEnvelope<{ items: KnowledgeItemRecord[] }>>(
    `/ai/groups/${encodeURIComponent(groupId)}/decisions`,
    { params: { limit } }
  );
  return response.data.data.items;
};

export const fetchGroupTasks = async (groupId: string, limit = 10) => {
  const response = await api.get<ApiEnvelope<{ items: KnowledgeItemRecord[] }>>(
    `/ai/groups/${encodeURIComponent(groupId)}/tasks`,
    { params: { limit } }
  );
  return response.data.data.items;
};

export const respondWithContext = async (payload: {
  chatId?: string;
  groupId?: string;
  selectedMessageId?: string;
  query: string;
  mode:
    | "SUMMARIZE"
    | "ANSWER_QUESTION"
    | "EXTRACT_TASKS"
    | "EXPLAIN"
    | "SEARCH_MEMORY"
    | "PROJECT_UPDATE";
  pinnedMemoryIds?: string[];
  tokenBudget?: number;
  model?: string;
}) => {
  const response = await api.post<ApiEnvelope<ContextRespondResult>>("/ai/context/respond", payload);
  return response.data.data;
};

export const semanticSearch = async (params: {
  q: string;
  from?: string;
  to?: string;
  person?: string;
  chatId?: string;
  groupId?: string;
  type?: "message" | "file" | "knowledge" | "memory" | "decision" | "task";
  limit?: number;
}) => {
  const response = await api.get<ApiEnvelope<{ query: string; groups: SemanticSearchResultGroup[] }>>(
    "/search/semantic",
    { params }
  );
  return response.data.data;
};
