import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { traceService } from "../observability/trace.service";

type ChatRole = "system" | "user" | "assistant";
export type ChatModel = "openrouter" | "openai" | "claude" | "gemini" | "grok";
export type ModelSelection = `${ChatModel}:${string}`;

export type AiChatInputMessage = {
  role: ChatRole;
  content: string;
};

export type AiCompletionUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type AiCompletionResult = {
  id: string | null;
  provider: "openrouter" | "openai" | "anthropic" | "gemini" | "xai";
  model: ChatModel;
  providerModelId: string;
  text: string;
  usage: AiCompletionUsage;
  retryCount: number;
  providerUsageRaw?: Record<string, unknown> | null;
};

type ModelRuntimeConfig = {
  enabled: Record<ChatModel, boolean>;
  multipliers: Record<ChatModel, number>;
  modelCatalog: Record<ChatModel, string[]>;
  freeSelections: Set<ModelSelection>;
};

const MODEL_LABELS: Record<ChatModel, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  claude: "Claude",
  gemini: "Gemini",
  grok: "Grok",
};

const MODEL_PROVIDER: Record<ChatModel, "openrouter" | "openai" | "anthropic" | "gemini" | "xai"> = {
  openrouter: "openrouter",
  openai: "openai",
  claude: "anthropic",
  gemini: "gemini",
  grok: "xai",
};

const PLAXE_O1_VERSION = "plaxe-o1";

const getDefaultProviderModelId = (model: ChatModel) => {
  if (model === "openrouter") return PLAXE_O1_VERSION;
  if (model === "openai") return env.OPENAI_DEFAULT_MODEL;
  if (model === "claude") return env.ANTHROPIC_DEFAULT_MODEL;
  if (model === "gemini") return env.GEMINI_DEFAULT_MODEL;
  return env.XAI_DEFAULT_MODEL;
};

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseModelCatalog = () => {
  const catalog: Record<ChatModel, string[]> = {
    openrouter: parseCsv(process.env.OPENROUTER_MODEL_VERSIONS ?? PLAXE_O1_VERSION),
    openai: parseCsv(process.env.OPENAI_MODEL_VERSIONS ?? env.OPENAI_DEFAULT_MODEL),
    claude: parseCsv(process.env.ANTHROPIC_MODEL_VERSIONS ?? env.ANTHROPIC_DEFAULT_MODEL),
    gemini: parseCsv(process.env.GEMINI_MODEL_VERSIONS ?? env.GEMINI_DEFAULT_MODEL),
    grok: parseCsv(process.env.XAI_MODEL_VERSIONS ?? env.XAI_DEFAULT_MODEL),
  };

  (Object.keys(catalog) as ChatModel[]).forEach((provider) => {
    const fallback = getDefaultProviderModelId(provider);
    if (!catalog[provider].includes(fallback)) {
      catalog[provider].unshift(fallback);
    }
  });
  return catalog;
};

const parseFreeSelections = () => {
  const configured = parseCsv(process.env.AI_FREE_MODEL_SELECTIONS ?? "");
  if (configured.length > 0) {
    return configured.map((value) => value.toLowerCase()) as ModelSelection[];
  }
  return (Object.keys(MODEL_PROVIDER) as ChatModel[]).map(
    (provider) => `${provider}:${getDefaultProviderModelId(provider)}` as ModelSelection
  );
};

const parseEnabledModelsFromEnv = () => {
  const allowed = new Set(
    env.AI_ENABLED_MODELS
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);
  const hasOpenAi = Boolean(env.OPENAI_API_KEY);
  const hasClaude = Boolean(env.ANTHROPIC_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);
  const hasGrok = Boolean(env.XAI_API_KEY);

  return {
    openrouter: allowed.has("openrouter") && hasOpenRouter,
    openai: allowed.has("openai") && hasOpenAi,
    claude: allowed.has("claude") && hasClaude,
    gemini: allowed.has("gemini") && hasGemini,
    grok: allowed.has("grok") && hasGrok,
  } satisfies Record<ChatModel, boolean>;
};

const runtimeConfig: ModelRuntimeConfig = {
  enabled: parseEnabledModelsFromEnv(),
  multipliers: {
    openrouter: env.AI_MULTIPLIER_OPENROUTER,
    openai: env.AI_MULTIPLIER_OPENAI,
    gemini: env.AI_MULTIPLIER_GEMINI,
    claude: env.AI_MULTIPLIER_CLAUDE,
    grok: env.AI_MULTIPLIER_GROK,
  },
  modelCatalog: parseModelCatalog(),
  freeSelections: new Set(parseFreeSelections()),
};

const listEnabledModels = (): ChatModel[] => {
  const models = (Object.keys(runtimeConfig.enabled) as ChatModel[]).filter(
    (model) => runtimeConfig.enabled[model]
  );
  if (models.length === 0) {
    throw new AppError(503, "No AI models are enabled.");
  }
  return models;
};

const normalizeModel = (rawModel?: string): ChatModel => {
  const normalized = (rawModel ?? "").trim().toLowerCase();
  const selected = (normalized.includes(":") ? normalized.split(":")[0] : normalized) as
    | ChatModel
    | "";
  const available = listEnabledModels();
  if (selected && available.includes(selected as ChatModel)) {
    return selected as ChatModel;
  }
  const configuredDefault = env.AI_DEFAULT_MODEL as ChatModel;
  if (available.includes(configuredDefault)) return configuredDefault;
  return available[0];
};

const listProviderVersions = (provider: ChatModel) => {
  const versions = runtimeConfig.modelCatalog[provider] ?? [];
  if (versions.length > 0) return versions;
  return [getDefaultProviderModelId(provider)];
};

const getDefaultSelection = (): ModelSelection => {
  const provider = normalizeModel(env.AI_DEFAULT_MODEL);
  const version = listProviderVersions(provider)[0];
  return `${provider}:${version}`;
};

const parseModelSelection = (raw?: string) => {
  const fallback = getDefaultSelection();
  const input = (raw ?? "").trim().toLowerCase();
  const value = input || fallback;
  const separator = value.indexOf(":");
  const providerToken = separator >= 0 ? value.slice(0, separator) : value;
  const versionToken = separator >= 0 ? value.slice(separator + 1) : "";
  const provider = normalizeModel(providerToken);
  const versions = listProviderVersions(provider);
  const version = versions.includes(versionToken) ? versionToken : versions[0];
  return {
    provider,
    version,
    selection: `${provider}:${version}` as ModelSelection,
  };
};

const isFreeSelection = (selection: string) => {
  return runtimeConfig.freeSelections.has(selection.toLowerCase() as ModelSelection);
};

const normalizeContentToken = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.output_text === "string") return obj.output_text;
    if (typeof obj.content === "string") return obj.content;
    if (obj.content !== undefined) return normalizeContentToken(obj.content);
    if (obj.parts !== undefined) return normalizeContentToken(obj.parts);
    if (obj.value !== undefined) return normalizeContentToken(obj.value);
    return "";
  }
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      return normalizeContentToken(item);
    })
    .join("");
};

const extractOpenAiCompatibleText = (choice: Record<string, unknown> | undefined) => {
  if (!choice) return "";
  const message =
    choice.message && typeof choice.message === "object"
      ? (choice.message as Record<string, unknown>)
      : null;
  if (message) {
    const content = normalizeContentToken(message.content);
    if (content.trim()) return content.trim();
    const refusal = normalizeContentToken((message as any).refusal);
    if (refusal.trim()) return refusal.trim();
    const reasoning =
      normalizeContentToken((message as any).reasoning) ||
      normalizeContentToken((message as any).reasoning_content);
    if (reasoning.trim()) return reasoning.trim();
  }
  const directText = normalizeContentToken(choice.text);
  if (directText.trim()) return directText.trim();
  return "";
};

const buildRollingSummary = (messages: AiChatInputMessage[]) => {
  const summaryLines = messages
    .filter((item) => item.role !== "system")
    .slice(-8)
    .map((item) => {
      const label = item.role === "assistant" ? "Assistant" : "User";
      const text = item.content.replace(/\s+/g, " ").trim().slice(0, 140);
      return `- ${label}: ${text}`;
    })
    .filter((line) => line.length > 4);

  if (summaryLines.length === 0) return "";
  return `Conversation summary of earlier context:\n${summaryLines.join("\n")}`;
};

const shouldRetryProviderError = (error: unknown) => {
  if (!(error instanceof AppError)) return false;
  if (error.statusCode >= 500) return true;
  if (/timeout|timed out/i.test(error.message)) return true;
  return false;
};

const withRetries = async <T>(fn: () => Promise<T>) => {
  const retries = Math.max(0, env.AI_PROVIDER_MAX_RETRIES);
  let attempt = 0;
  while (true) {
    try {
      return { result: await fn(), retryCount: attempt };
    } catch (error) {
      if (attempt >= retries || !shouldRetryProviderError(error)) {
        throw error;
      }
      attempt += 1;
    }
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, env.AI_PROVIDER_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const mergedSignal = init.signal;
    if (mergedSignal) {
      mergedSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(504, `AI provider timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getTrimmedMessages = (messages: AiChatInputMessage[]) => {
  const cleaned = messages
    .map(
      (item): AiChatInputMessage => ({
        role: item.role,
        content: item.content.trim(),
      })
    )
    .filter((item) => item.content.length > 0);

  if (cleaned.length === 0) {
    throw new AppError(400, "At least one non-empty message is required.");
  }

  const limit = Math.max(1, env.AI_MAX_CONTEXT_MESSAGES);
  if (cleaned.length <= limit) return cleaned;

  const dropped = cleaned.slice(0, cleaned.length - limit);
  const kept = cleaned.slice(-limit);
  const summary = buildRollingSummary(dropped);
  if (!summary) return kept;
  return [{ role: "system" as const, content: summary }, ...kept];
};

const splitSystemAndMessages = (messages: AiChatInputMessage[]) => {
  const systemMessages = messages
    .filter((item) => item.role === "system")
    .map((item) => item.content.trim())
    .filter(Boolean);

  const nonSystem = messages.filter((item) => item.role !== "system");
  return {
    systemPrompt: systemMessages.join("\n\n").trim() || undefined,
    messages: nonSystem,
  };
};

const parseOpenAiCompatibleUsage = (value: unknown): AiCompletionUsage => {
  if (!value || typeof value !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const raw = value as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  return {
    promptTokens: raw.prompt_tokens ?? 0,
    completionTokens: raw.completion_tokens ?? 0,
    totalTokens: raw.total_tokens ?? 0,
  };
};

const parseProviderErrorMessage = (rawError: string) => {
  const fallback = rawError.trim().slice(0, 300);
  if (!fallback) return "Unknown provider error.";
  try {
    const parsed = JSON.parse(rawError) as Record<string, unknown>;
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim().slice(0, 300);
    }
    const err =
      parsed.error && typeof parsed.error === "object"
        ? (parsed.error as Record<string, unknown>)
        : null;
    if (err) {
      if (typeof err.message === "string" && err.message.trim()) {
        return err.message.trim().slice(0, 300);
      }
      if (typeof err.code === "string" && err.code.trim()) {
        return err.code.trim().slice(0, 300);
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
};

const callOpenAiCompatible = async (params: {
  model: ChatModel;
  modelVersion: string;
  messages: AiChatInputMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<AiCompletionResult> => {
  const provider = MODEL_PROVIDER[params.model];
  const useOpenRouter = params.model === "openrouter";
  const baseModel =
    useOpenRouter && params.modelVersion === PLAXE_O1_VERSION
      ? env.OPENROUTER_FREE_MODEL
      : params.modelVersion;
  const baseUrl = useOpenRouter
    ? env.OPENROUTER_BASE_URL
    : params.model === "openai"
      ? env.OPENAI_BASE_URL
      : env.XAI_BASE_URL;
  const apiKey = useOpenRouter
    ? env.OPENROUTER_API_KEY
    : params.model === "openai"
      ? env.OPENAI_API_KEY
      : env.XAI_API_KEY;
  const traceId = traceService.getTraceContext()?.traceId;

  if (!apiKey) {
    throw new AppError(503, `Missing API key for ${provider}.`);
  }

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(traceId ? { "x-trace-id": traceId } : {}),
    },
    body: JSON.stringify({
      model: baseModel,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      messages: params.messages,
    }),
  });

  if (!response.ok) {
    const rawError = await response.text();
    const providerLabel = MODEL_LABELS[params.model];
    const reason = parseProviderErrorMessage(rawError);
    throw new AppError(
      response.status === 429 ? 429 : 502,
      `${providerLabel} request failed: ${reason}`,
      {
        providerStatus: response.status,
        providerError: rawError.slice(0, 1000),
      }
    );
  }

  const payload = (await response.json()) as {
    id?: string;
    choices?: Array<{
      message?: {
        content?: unknown;
      };
      text?: string;
    }>;
    usage?: unknown;
  };

  const firstChoice = (payload.choices?.[0] ?? undefined) as Record<string, unknown> | undefined;
  const text = extractOpenAiCompatibleText(firstChoice);
  if (!text) {
    throw new AppError(502, `${MODEL_LABELS[params.model]} returned an empty response.`, {
      providerModelId: baseModel,
      choiceKeys: firstChoice ? Object.keys(firstChoice) : [],
      messageKeys:
        firstChoice?.message && typeof firstChoice.message === "object"
          ? Object.keys(firstChoice.message as Record<string, unknown>)
          : [],
    });
  }

  return {
    id: payload.id ?? null,
    provider: provider,
    model: params.model,
    providerModelId: baseModel,
    text,
    retryCount: 0,
    usage: parseOpenAiCompatibleUsage(payload.usage),
    providerUsageRaw:
      payload.usage && typeof payload.usage === "object"
        ? (payload.usage as Record<string, unknown>)
        : null,
  };
};

const callAnthropic = async (params: {
  model: ChatModel;
  modelVersion: string;
  messages: AiChatInputMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<AiCompletionResult> => {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, "Missing API key for Anthropic.");
  }
  const traceId = traceService.getTraceContext()?.traceId;
  const split = splitSystemAndMessages(params.messages);

  const response = await fetchWithTimeout(`${env.ANTHROPIC_BASE_URL}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      ...(traceId ? { "x-trace-id": traceId } : {}),
    },
    body: JSON.stringify({
      model: params.modelVersion,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      ...(split.systemPrompt ? { system: split.systemPrompt } : {}),
      messages: split.messages.map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content,
      })),
    }),
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new AppError(502, "Claude request failed.", rawError.slice(0, 1000));
  }

  const payload = (await response.json()) as {
    id?: string;
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = payload.content?.map((block) => block.text ?? "").join("").trim() ?? "";
  if (!text) {
    throw new AppError(502, "Claude returned an empty response.");
  }

  const promptTokens = payload.usage?.input_tokens ?? 0;
  const completionTokens = payload.usage?.output_tokens ?? 0;
  return {
    id: payload.id ?? null,
    provider: MODEL_PROVIDER[params.model],
    model: params.model,
    providerModelId: params.modelVersion,
    text,
    retryCount: 0,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
    providerUsageRaw:
      payload.usage && typeof payload.usage === "object"
        ? (payload.usage as Record<string, unknown>)
        : null,
  };
};

const callGemini = async (params: {
  model: ChatModel;
  modelVersion: string;
  messages: AiChatInputMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<AiCompletionResult> => {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "Missing API key for Gemini.");
  }
  const traceId = traceService.getTraceContext()?.traceId;

  const split = splitSystemAndMessages(params.messages);
  const endpoint = `${env.GEMINI_BASE_URL}/models/${encodeURIComponent(
    params.modelVersion
  )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(traceId ? { "x-trace-id": traceId } : {}),
    },
    body: JSON.stringify({
      ...(split.systemPrompt
        ? { systemInstruction: { parts: [{ text: split.systemPrompt }] } }
        : {}),
      contents: split.messages.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new AppError(502, "Gemini request failed.", rawError.slice(0, 1000));
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new AppError(502, "Gemini returned an empty response.");
  }

  return {
    id: null,
    provider: MODEL_PROVIDER[params.model],
    model: params.model,
    providerModelId: params.modelVersion,
    text,
    retryCount: 0,
    usage: {
      promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: payload.usageMetadata?.totalTokenCount ?? 0,
    },
    providerUsageRaw:
      payload.usageMetadata && typeof payload.usageMetadata === "object"
        ? (payload.usageMetadata as Record<string, unknown>)
        : null,
  };
};

const createChatCompletion = async (params: {
  model?: string;
  modelVersion?: string;
  messages: AiChatInputMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<AiCompletionResult> => {
  const selected = parseModelSelection(
    params.modelVersion ? `${params.model ?? ""}:${params.modelVersion}` : params.model
  );
  const model = selected.provider;
  const modelVersion = selected.version;
  const messages = getTrimmedMessages(params.messages);
  const temperature = typeof params.temperature === "number" ? params.temperature : 0.7;
  const requestedMax = typeof params.maxTokens === "number" ? params.maxTokens : 512;
  const maxTokens = Math.min(Math.max(1, Math.floor(requestedMax)), env.AI_MAX_TOKENS_PER_REQUEST);

  if (model === "openrouter" || model === "openai" || model === "grok") {
    const value = await withRetries(() =>
      callOpenAiCompatible({
        model,
        modelVersion,
        messages,
        temperature,
        maxTokens,
      })
    );
    return { ...value.result, retryCount: value.retryCount };
  }
  if (model === "claude") {
    const value = await withRetries(() =>
      callAnthropic({
        model,
        modelVersion,
        messages,
        temperature,
        maxTokens,
      })
    );
    return { ...value.result, retryCount: value.retryCount };
  }
  const value = await withRetries(() =>
    callGemini({
      model,
      modelVersion,
      messages,
      temperature,
      maxTokens,
    })
  );
  return { ...value.result, retryCount: value.retryCount };
};

const extractStreamToken = (payload: Record<string, unknown>): string => {
  const choices = Array.isArray(payload.choices)
    ? (payload.choices as Array<Record<string, unknown>>)
    : [];
  const first = choices[0] ?? {};

  const delta =
    first.delta && typeof first.delta === "object"
      ? (first.delta as Record<string, unknown>)
      : null;
  const message =
    first.message && typeof first.message === "object"
      ? (first.message as Record<string, unknown>)
      : null;

  if (delta) {
    const fromDeltaContent = normalizeContentToken(delta.content);
    if (fromDeltaContent) return fromDeltaContent;
    const fromDeltaReasoning =
      normalizeContentToken((delta as any).reasoning) ||
      normalizeContentToken((delta as any).reasoning_content);
    if (fromDeltaReasoning) return fromDeltaReasoning;
  }

  if (message) {
    const fromMessageContent = normalizeContentToken(message.content);
    if (fromMessageContent) return fromMessageContent;
    const fromMessageReasoning =
      normalizeContentToken((message as any).reasoning) ||
      normalizeContentToken((message as any).reasoning_content);
    if (fromMessageReasoning) return fromMessageReasoning;
    const fromRefusal = normalizeContentToken((message as any).refusal);
    if (fromRefusal) return fromRefusal;
  }

  if (typeof first.text === "string") return first.text;
  return "";
};

const streamOpenAiCompatible = async (
  params: {
    model: ChatModel;
    modelVersion: string;
    messages: AiChatInputMessage[];
    temperature: number;
    maxTokens: number;
    signal?: AbortSignal;
  },
  onChunk: (value: string) => void
) => {
  const useOpenRouter = params.model === "openrouter";
  const baseUrl = useOpenRouter
    ? env.OPENROUTER_BASE_URL
    : params.model === "openai"
      ? env.OPENAI_BASE_URL
      : env.XAI_BASE_URL;
  const apiKey = useOpenRouter
    ? env.OPENROUTER_API_KEY
    : params.model === "openai"
      ? env.OPENAI_API_KEY
      : env.XAI_API_KEY;
  const traceId = traceService.getTraceContext()?.traceId;
  if (!apiKey) {
    throw new AppError(503, `Missing API key for ${MODEL_LABELS[params.model]}.`);
  }

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: params.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(traceId ? { "x-trace-id": traceId } : {}),
    },
    body: JSON.stringify({
      model:
        useOpenRouter && params.modelVersion === PLAXE_O1_VERSION
          ? env.OPENROUTER_FREE_MODEL
          : params.modelVersion,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      messages: params.messages,
    }),
  });

  if (!response.ok || !response.body) {
    const rawError = await response.text();
    const providerLabel = MODEL_LABELS[params.model];
    const reason = parseProviderErrorMessage(rawError);
    throw new AppError(
      response.status === 429 ? 429 : 502,
      `${providerLabel} stream failed: ${reason}`,
      {
        providerStatus: response.status,
        providerError: rawError.slice(0, 1000),
      }
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let buffer = "";
  let fullText = "";
  let usageFromProvider: AiCompletionUsage | null = null;
  let providerUsageRaw: Record<string, unknown> | null = null;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    buffer += decoder.decode(chunk.value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = done ? "" : blocks.pop() ?? "";

    for (const block of blocks) {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const line of lines) {
        if (!line || line === "[DONE]") continue;

        try {
          const payload = JSON.parse(line) as {
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            };
          } & Record<string, unknown>;

          if (payload.usage) {
            usageFromProvider = {
              promptTokens: payload.usage.prompt_tokens ?? 0,
              completionTokens: payload.usage.completion_tokens ?? 0,
              totalTokens: payload.usage.total_tokens ?? 0,
            };
            providerUsageRaw = payload.usage as Record<string, unknown>;
          }
          const token = extractStreamToken(payload);
          if (!token) continue;
          fullText += token;
          onChunk(token);
        } catch {
          continue;
        }
      }
    }
  }

  if (!fullText.trim()) {
    throw new AppError(502, `${MODEL_LABELS[params.model]} returned an empty streamed response.`);
  }

  return {
    id: null,
    provider: MODEL_PROVIDER[params.model],
    model: params.model,
    providerModelId: params.modelVersion,
    text: fullText,
    retryCount: 0,
    usage: usageFromProvider,
    providerUsageRaw,
  };
};

const streamChatCompletion = async (
  params: {
    model?: string;
    modelVersion?: string;
    messages: AiChatInputMessage[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  },
  onChunk: (value: string) => void
) => {
  const selected = parseModelSelection(
    params.modelVersion ? `${params.model ?? ""}:${params.modelVersion}` : params.model
  );
  const model = selected.provider;
  const modelVersion = selected.version;
  const messages = getTrimmedMessages(params.messages);
  const temperature = typeof params.temperature === "number" ? params.temperature : 0.7;
  const requestedMax = typeof params.maxTokens === "number" ? params.maxTokens : 512;
  const maxTokens = Math.min(Math.max(1, Math.floor(requestedMax)), env.AI_MAX_TOKENS_PER_REQUEST);

  // OpenRouter free models are not consistently stream-compatible across providers.
  // Use one-shot completion and emit as a single chunk for reliability.
  if (model === "openrouter") {
    const oneShot = await createChatCompletion({
      model,
      modelVersion,
      messages,
      temperature,
      maxTokens,
    });
    onChunk(oneShot.text);
    return oneShot;
  }

  if (model === "openai" || model === "grok") {
    return streamOpenAiCompatible(
      {
        model,
        modelVersion,
        messages,
        temperature,
        maxTokens,
        signal: params.signal,
      },
      onChunk
    );
  }

  const oneShot = await createChatCompletion({
    model,
    modelVersion,
    messages,
    temperature,
    maxTokens,
  });
  onChunk(oneShot.text);
  return oneShot;
};

const getModelConfig = () => {
  const models = listEnabledModels();
  const defaultSelection = getDefaultSelection();
  return {
    provider: "multi" as const,
    models,
    modelLabels: models.reduce<Record<string, string>>((acc, item) => {
      acc[item] = MODEL_LABELS[item];
      return acc;
    }, {}),
    defaultModel: parseModelSelection(defaultSelection).provider,
    defaultSelection,
    providerVersions: models.reduce<Record<ChatModel, string[]>>((acc, item) => {
      acc[item] = listProviderVersions(item);
      return acc;
    }, {} as Record<ChatModel, string[]>),
  };
};

const getAdminConfig = () => {
  const enabledModels = listEnabledModels();
  return {
    enabledModels,
    multipliers: { ...runtimeConfig.multipliers },
  };
};

const setModelEnabled = (model: ChatModel, enabled: boolean) => {
  runtimeConfig.enabled[model] = enabled;
};

const setModelMultiplier = (model: ChatModel, multiplier: number) => {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new AppError(400, "multiplier must be a positive number");
  }
  runtimeConfig.multipliers[model] = Number(multiplier.toFixed(4));
};

const getModelMultiplier = (model: ChatModel) => runtimeConfig.multipliers[model];

export const aiService = {
  createChatCompletion,
  streamChatCompletion,
  getModelConfig,
  getAdminConfig,
  setModelEnabled,
  setModelMultiplier,
  getModelMultiplier,
  listEnabledModels,
  normalizeModel,
  parseModelSelection,
  isFreeSelection,
  getDefaultSelection,
  listProviderVersions,
};
