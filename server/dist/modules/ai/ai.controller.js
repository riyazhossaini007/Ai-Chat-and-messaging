"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuditChain = exports.patchAiAdminConfig = exports.getAiAdminConfig = exports.cancelAiChatStream = exports.getProviderHealth = exports.postAiChatStream = exports.getAiModels = exports.postAiChat = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const credits_service_1 = require("../credits/credits.service");
const ai_service_1 = require("./ai.service");
const reliability_service_1 = require("./reliability.service");
const promptGuard_service_1 = require("../security/promptGuard.service");
const security_service_1 = require("../security/security.service");
const redisRateLimiter_service_1 = require("../security/redisRateLimiter.service");
const trace_service_1 = require("../observability/trace.service");
const activeStreamControllers = new Map();
const modelCooldowns = new Map();
const prismaAny = prisma_1.prisma;
const mapAiUsageProvider = (provider) => provider.toLowerCase().includes("openrouter") ? "OPENROUTER" : "OPENAI";
const recordAiUsageEvent = async (input) => {
    if (!input.userId)
        return;
    await prismaAny.aiUsageEvent
        ?.create?.({
        data: {
            userId: input.userId,
            modelProvider: mapAiUsageProvider(input.provider),
            modelName: input.modelName,
            tokensIn: Math.max(0, Number(input.tokensIn ?? 0)),
            tokensOut: Math.max(0, Number(input.tokensOut ?? 0)),
            costUsd: input.costUsd ?? null,
            status: input.status,
            errorCode: input.errorCode ?? null,
        },
    })
        .catch(() => undefined);
};
const toRole = (value) => {
    if (value === "user")
        return "user";
    if (value === "assistant")
        return "assistant";
    if (value === "system")
        return "system";
    return null;
};
const parseMessages = (value) => {
    if (!Array.isArray(value)) {
        throw new errorHandler_1.AppError(400, "messages must be an array");
    }
    const parsed = value.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new errorHandler_1.AppError(400, "Each message must be an object");
        }
        const raw = item;
        const role = toRole(raw.role);
        const content = raw.content;
        if (!role) {
            throw new errorHandler_1.AppError(400, "Message role must be one of: system, user, assistant");
        }
        if (typeof content !== "string") {
            throw new errorHandler_1.AppError(400, "Message content must be a string");
        }
        return { role, content };
    });
    if (parsed.length === 0) {
        throw new errorHandler_1.AppError(400, "messages cannot be empty");
    }
    return parsed;
};
const parseTemperature = (value) => {
    if (value === undefined)
        return undefined;
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 2) {
        throw new errorHandler_1.AppError(400, "temperature must be a number between 0 and 2");
    }
    return value;
};
const parseMaxTokens = (value) => {
    if (value === undefined)
        return undefined;
    if (typeof value !== "number" ||
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > env_1.env.AI_MAX_TOKENS_PER_REQUEST) {
        throw new errorHandler_1.AppError(400, `maxTokens must be an integer between 1 and ${env_1.env.AI_MAX_TOKENS_PER_REQUEST}`);
    }
    return value;
};
const parseRequestId = (value) => {
    if (typeof value !== "string") {
        throw new errorHandler_1.AppError(400, "requestId is required and must be a UUID string");
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new errorHandler_1.AppError(400, "requestId is required and must be a UUID string");
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(trimmed)) {
        throw new errorHandler_1.AppError(400, "requestId must be a valid UUID");
    }
    return trimmed;
};
const parseChatId = (value) => {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};
const parseRegeneratedFromRequestId = (value) => {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(trimmed)) {
        throw new errorHandler_1.AppError(400, "regeneratedFromRequestId must be a valid UUID");
    }
    return trimmed;
};
const estimateTokensFromText = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return 0;
    return Math.max(1, Math.ceil(trimmed.length / 4));
};
const estimatePromptTokens = (messages) => {
    return messages.reduce((sum, item) => sum + estimateTokensFromText(item.content), 0);
};
const finalizeUsage = (providerUsage, input) => {
    if (providerUsage) {
        const promptTokens = Math.max(0, providerUsage.promptTokens);
        const completionTokens = Math.max(0, providerUsage.completionTokens);
        const totalTokens = providerUsage.totalTokens > 0
            ? providerUsage.totalTokens
            : promptTokens + completionTokens;
        if (totalTokens > 0) {
            return {
                promptTokens,
                completionTokens,
                totalTokens,
            };
        }
    }
    const promptTokens = estimatePromptTokens(input.messages);
    const completionTokens = estimateTokensFromText(input.completionText);
    return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
    };
};
const calculateCostUsd = (usage) => {
    const promptCost = (usage.promptTokens / 1000) * env_1.env.AI_PROMPT_COST_USD_PER_1K;
    const completionCost = (usage.completionTokens / 1000) * env_1.env.AI_COMPLETION_COST_USD_PER_1K;
    const total = promptCost + completionCost;
    return Number(total.toFixed(8));
};
const isAbortError = (error) => {
    if (!(error instanceof Error))
        return false;
    return (error.name === "AbortError" ||
        /aborted|cancelled|canceled/i.test(error.message));
};
const sendCreditsRequired = (res) => {
    return res.status(402).json({
        success: false,
        error: "CREDITS_REQUIRED",
        message: "Buy credits to use AI models",
    });
};
const sendModelCooldown = (res, waitMs) => {
    return res.status(429).json({
        success: false,
        error: "MODEL_COOLDOWN",
        message: `Try again in ${Math.max(1, Math.ceil(waitMs / 1000))}s`,
        retryAfterMs: waitMs,
    });
};
const sendRateLimited = (res, retryAfterMs) => {
    return res.status(429).json({
        success: false,
        error: "RATE_LIMITED",
        message: `Too many requests. Try again in ${Math.max(1, Math.ceil(retryAfterMs / 1000))} seconds.`,
        retryAfterMs,
    });
};
const isChatModel = (value) => {
    return (value === "openrouter" ||
        value === "openai" ||
        value === "claude" ||
        value === "gemini" ||
        value === "grok");
};
const sendModelNotAllowed = (res, input) => {
    return res.status(403).json({
        success: false,
        error: "MODEL_NOT_ALLOWED",
        message: "Selected model is available on paid plans only.",
        allowedSelections: input.allowedSelections,
        defaultSelection: input.defaultSelection,
    });
};
const sendProviderDegraded = (res, input) => {
    return res.status(503).json({
        success: false,
        error: "PROVIDER_DEGRADED",
        message: `${input.provider} is currently degraded. Choose a different model or retry.`,
        suggestedModels: input.suggestedModels,
        switchedTo: input.switchedTo ?? null,
    });
};
const isProviderDegradedError = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return false;
    if (!error.details || typeof error.details !== "object")
        return false;
    const details = error.details;
    return details.error === "PROVIDER_DEGRADED";
};
const isCreditsRequiredError = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return false;
    if (error.details && typeof error.details === "object") {
        const details = error.details;
        return details.error === "CREDITS_REQUIRED" || details.code === "CREDITS_REQUIRED";
    }
    return false;
};
const isModelCooldownError = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return false;
    if (!error.details || typeof error.details !== "object")
        return false;
    const details = error.details;
    return details.error === "MODEL_COOLDOWN";
};
const isRateLimitedError = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return false;
    if (!error.details || typeof error.details !== "object")
        return false;
    const details = error.details;
    return details.error === "RATE_LIMITED";
};
const isModelNotAllowedError = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return false;
    if (!error.details || typeof error.details !== "object")
        return false;
    const details = error.details;
    return details.error === "MODEL_NOT_ALLOWED";
};
const getRateLimitRetryAfterMs = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return 0;
    if (!error.details || typeof error.details !== "object")
        return 0;
    const details = error.details;
    return typeof details.retryAfterMs === "number" ? details.retryAfterMs : 1000;
};
const getModelCooldownWaitMs = (error) => {
    if (!(error instanceof errorHandler_1.AppError))
        return 0;
    if (!error.details || typeof error.details !== "object")
        return 0;
    const details = error.details;
    return typeof details.retryAfterMs === "number" ? details.retryAfterMs : 0;
};
const resolveAllowedModelSelections = async (userId) => {
    const enabledModels = ai_service_1.aiService.listEnabledModels();
    const allSelections = enabledModels.flatMap((provider) => ai_service_1.aiService.listProviderVersions(provider).map((version) => `${provider}:${version}`));
    const hasPaidOrComplimentaryAiAccess = await credits_service_1.creditsService.hasActiveSubscription(userId);
    if (hasPaidOrComplimentaryAiAccess) {
        return {
            subscriptionActive: true,
            allowedSelections: allSelections,
            defaultSelection: ai_service_1.aiService.getDefaultSelection(),
            allSelections,
        };
    }
    const freeSelections = allSelections.filter((selection) => ai_service_1.aiService.isFreeSelection(selection));
    if (freeSelections.length === 0) {
        throw new errorHandler_1.AppError(503, "No free AI model versions are configured.");
    }
    return {
        subscriptionActive: false,
        allowedSelections: freeSelections,
        defaultSelection: freeSelections[0],
        allSelections,
    };
};
const resolveAllowedModelSelection = (selectedSelection, allowedSelections, defaultSelection) => {
    if (allowedSelections.includes(selectedSelection))
        return selectedSelection;
    return defaultSelection;
};
const filterAllowedSuggestions = (suggestedModels, allowedSelections) => {
    const allowedProviders = new Set(allowedSelections.map((selection) => selection.split(":")[0]).filter(isChatModel));
    return suggestedModels.filter((item) => {
        const model = item.trim().toLowerCase();
        return isChatModel(model) && allowedProviders.has(model);
    });
};
const enforceAiRateLimit = async (req, messages) => {
    const userId = req.user?.id ?? "unknown";
    const ip = req.ip ?? "unknown";
    const estimated = estimatePromptTokens(messages);
    const result = await redisRateLimiter_service_1.redisRateLimiterService.consumeAiBudgets({
        userId,
        ip,
        estimatedTokens: estimated,
    });
    if (!result.allowed) {
        await security_service_1.securityService.logSecurityEvent({
            userId: req.user?.id,
            type: "RATE_LIMIT_VIOLATION",
            route: req.originalUrl,
            ip,
            userAgent: req.headers["user-agent"],
            requestId: String(req.body?.requestId ?? ""),
            details: { retryAfterMs: result.retryAfterMs, estimated },
        });
        throw new errorHandler_1.AppError(429, "Too many requests. Try again later.", {
            error: "RATE_LIMITED",
            retryAfterMs: result.retryAfterMs,
        });
    }
};
const enforceModelCooldown = (userId, model) => {
    if (model !== "claude" && model !== "grok")
        return;
    const now = Date.now();
    const key = `${userId}:${model}`;
    const nextAllowedAt = modelCooldowns.get(key) ?? 0;
    if (nextAllowedAt > now) {
        const waitMs = nextAllowedAt - now;
        throw new errorHandler_1.AppError(429, `Try again in ${Math.ceil(waitMs / 1000)}s`, {
            error: "MODEL_COOLDOWN",
            code: "MODEL_COOLDOWN",
            retryAfterMs: waitMs,
            model,
        });
    }
    modelCooldowns.set(key, now + env_1.env.AI_REASONING_COOLDOWN_MS);
};
const loadAiConfigRow = async () => {
    const existing = await prisma_1.prisma.aiConfig.findUnique({
        where: { id: "singleton" },
    });
    if (existing)
        return existing;
    const admin = ai_service_1.aiService.getAdminConfig();
    return prisma_1.prisma.aiConfig.create({
        data: {
            id: "singleton",
            enabledModels: admin.enabledModels,
            multipliers: admin.multipliers,
            limits: {
                maxContextMessages: env_1.env.AI_MAX_CONTEXT_MESSAGES,
                maxTokensPerRequest: env_1.env.AI_MAX_TOKENS_PER_REQUEST,
            },
            cooldowns: {
                reasoningCooldownMs: env_1.env.AI_REASONING_COOLDOWN_MS,
            },
            version: 1,
        },
    });
};
const postAiChat = async (req, res, next) => {
    const body = req.body;
    const requestId = parseRequestId(body.requestId);
    const chatId = parseChatId(body.chatId);
    const regeneratedFromRequestId = parseRegeneratedFromRequestId(body.regeneratedFromRequestId);
    const traceId = req.traceId ?? requestId;
    let estimatedTokenBudget = 0;
    let requestStartedAtMs = Date.now();
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const userId = req.user.id;
        const existing = await prisma_1.prisma.aiRequestLog.findUnique({
            where: { requestId },
            select: {
                userId: true,
                status: true,
                charged: true,
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
                costUsd: true,
                model: true,
                provider: true,
            },
        });
        if (existing) {
            if (existing.userId !== req.user.id) {
                throw new errorHandler_1.AppError(409, "requestId already exists for a different user");
            }
            if (existing.status === "RUNNING") {
                throw new errorHandler_1.AppError(409, "Request is already in progress");
            }
            if (existing.status === "OK") {
                return (0, response_1.sendSuccess)(res, {
                    requestId,
                    status: existing.status,
                    charged: existing.charged,
                    usage: {
                        promptTokens: existing.promptTokens,
                        completionTokens: existing.completionTokens,
                        totalTokens: existing.totalTokens,
                    },
                    costUsd: existing.costUsd,
                    model: existing.model,
                    provider: existing.provider,
                }, "Request already processed");
            }
        }
        const guarded = await trace_service_1.traceService.withSpan("ai.context_build", { requestId, traceId, chatId: chatId ?? null }, async () => {
            const rawMessages = parseMessages(body.messages);
            return promptGuard_service_1.promptGuardService.enforcePromptGuardrails(rawMessages);
        });
        const messages = guarded.messages;
        if (guarded.risky) {
            await security_service_1.securityService.logSecurityEvent({
                userId,
                type: "PROMPT_INJECTION_ATTEMPT",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                requestId,
                details: { matches: guarded.matches, mode: "sync" },
            });
        }
        const modelAccess = await resolveAllowedModelSelections(userId);
        const rawModel = typeof body.model === "string" && body.model.trim().length > 0
            ? body.model
            : modelAccess.defaultSelection;
        let selected = ai_service_1.aiService.parseModelSelection(rawModel);
        let selectedModel = selected.provider;
        let selectedVersion = selected.version;
        let selectedSelection = selected.selection;
        const allowedSelection = resolveAllowedModelSelection(selectedSelection, modelAccess.allowedSelections, modelAccess.defaultSelection);
        if (allowedSelection !== selectedSelection) {
            selected = ai_service_1.aiService.parseModelSelection(allowedSelection);
            selectedModel = selected.provider;
            selectedVersion = selected.version;
            selectedSelection = selected.selection;
        }
        const originallySelectedModel = selectedModel;
        const temperature = parseTemperature(body.temperature);
        const maxTokens = parseMaxTokens(body.maxTokens);
        await trace_service_1.traceService.withSpan("ai.auth_and_gate", { requestId, traceId }, async () => {
            if (modelAccess.subscriptionActive) {
                await credits_service_1.creditsService.assertCanUseAi(userId);
            }
        });
        estimatedTokenBudget = estimatePromptTokens(messages);
        await enforceAiRateLimit(req, messages);
        enforceModelCooldown(userId, selectedModel);
        const preflight = await reliability_service_1.reliabilityService.checkProviderBeforeRequest(selectedModel);
        if (preflight.blocked) {
            const fallback = await reliability_service_1.reliabilityService.resolveFallbackModel(selectedModel);
            if (fallback.mode === "AUTO" &&
                fallback.fallbackModel &&
                modelAccess.allowedSelections.some((selection) => selection.startsWith(`${fallback.fallbackModel}:`))) {
                console.info(JSON.stringify({
                    event: "ai.provider.auto_fallback",
                    requestId,
                    userId: req.user.id,
                    from: selectedModel,
                    to: fallback.fallbackModel,
                }));
                selectedModel = fallback.fallbackModel;
                selectedVersion = ai_service_1.aiService.listProviderVersions(selectedModel)[0];
                selectedSelection = `${selectedModel}:${selectedVersion}`;
            }
            else {
                console.warn(JSON.stringify({
                    event: "ai.provider.degraded_block",
                    requestId,
                    userId: req.user.id,
                    provider: preflight.provider,
                    suggestedModels: filterAllowedSuggestions(fallback.suggestions, modelAccess.allowedSelections),
                }));
                return sendProviderDegraded(res, {
                    provider: preflight.provider,
                    suggestedModels: filterAllowedSuggestions(fallback.suggestions, modelAccess.allowedSelections),
                });
            }
        }
        if (existing && (existing.status === "ERROR" || existing.status === "CANCELLED")) {
            await prisma_1.prisma.aiRequestLog.update({
                where: { requestId },
                data: {
                    traceId,
                    chatId,
                    provider: "router",
                    providerModelId: selectedVersion,
                    model: selectedModel,
                    isRegeneration: Boolean(regeneratedFromRequestId),
                    regeneratedFromRequestId,
                    isStream: false,
                    temperature,
                    maxTokens,
                    status: "RUNNING",
                    errorCode: null,
                    errorMessage: null,
                    finishedAt: null,
                    estimatorUsed: false,
                    providerUsageRaw: client_1.Prisma.JsonNull,
                    startedAt: new Date(),
                },
            });
        }
        else {
            await prisma_1.prisma.aiRequestLog.create({
                data: {
                    requestId,
                    traceId,
                    userId: req.user.id,
                    chatId,
                    provider: "router",
                    providerModelId: selectedVersion,
                    model: selectedModel,
                    isRegeneration: Boolean(regeneratedFromRequestId),
                    regeneratedFromRequestId,
                    isStream: false,
                    temperature,
                    maxTokens,
                    status: "RUNNING",
                    startedAt: new Date(),
                },
            });
        }
        requestStartedAtMs = Date.now();
        const result = await trace_service_1.traceService.withSpan("ai.provider_call", {
            requestId,
            traceId,
            provider: selectedModel,
            model: selectedModel,
            timeoutMs: env_1.env.AI_PROVIDER_TIMEOUT_MS,
        }, async () => ai_service_1.aiService.createChatCompletion({
            messages,
            model: selectedModel,
            modelVersion: selectedVersion,
            temperature,
            maxTokens,
        }));
        await reliability_service_1.reliabilityService.recordRequestSuccess(selectedModel, Date.now() - requestStartedAtMs);
        const usage = finalizeUsage(result.usage, {
            messages,
            completionText: result.text,
        });
        if (usage.totalTokens < estimatedTokenBudget) {
            await redisRateLimiter_service_1.redisRateLimiterService.refundTokenBudget({
                userId: req.user.id,
                tokens: estimatedTokenBudget - usage.totalTokens,
            });
        }
        const costUsd = calculateCostUsd(usage);
        await trace_service_1.traceService.withSpan("ai.response_write", { requestId, traceId }, async () => {
            await prisma_1.prisma.aiRequestLog.update({
                where: { requestId },
                data: {
                    traceId,
                    provider: result.provider,
                    providerModelId: result.providerModelId,
                    model: result.model,
                    status: "OK",
                    retryCount: result.retryCount ?? 0,
                    latencyMs: Date.now() - requestStartedAtMs,
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                    estimatorUsed: !Boolean(result.providerUsageRaw),
                    providerUsageRaw: result.providerUsageRaw
                        ? result.providerUsageRaw
                        : undefined,
                    costUsd,
                    finishedAt: new Date(),
                },
            });
        });
        await recordAiUsageEvent({
            userId: req.user.id,
            provider: result.provider,
            modelName: result.model,
            tokensIn: usage.promptTokens,
            tokensOut: usage.completionTokens,
            costUsd,
            status: "OK",
        });
        const chargeResult = await trace_service_1.traceService.withSpan("ai.billing_charge", { requestId, traceId }, async () => credits_service_1.creditsService.chargeForAiRequest(requestId));
        console.info(JSON.stringify({
            event: "ai.request.ok",
            requestId,
            userId: req.user.id,
            provider: result.provider,
            model: result.model,
            totalTokens: usage.totalTokens,
            latencyMs: Date.now() - requestStartedAtMs,
            retryCount: result.retryCount ?? 0,
            traceId,
            isRegeneration: Boolean(regeneratedFromRequestId),
            charged: chargeResult.charged,
        }));
        return (0, response_1.sendSuccess)(res, {
            reply: {
                ...result,
                id: requestId,
                usage,
                costUsd,
                switchedFromModel: originallySelectedModel !== selectedModel ? originallySelectedModel : null,
                switchedToModel: originallySelectedModel !== selectedModel ? selectedModel : null,
            },
        }, "AI response created");
    }
    catch (error) {
        if (isCreditsRequiredError(error)) {
            console.info(JSON.stringify({
                event: "ai.request.paywall_block",
                requestId,
                traceId,
                userId: req.user?.id ?? null,
            }));
            await security_service_1.securityService.logSecurityEvent({
                userId: req.user?.id,
                type: "PAYWALL_BLOCK",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                requestId,
                details: { reason: "CREDITS_REQUIRED" },
            });
            return sendCreditsRequired(res);
        }
        if (isModelNotAllowedError(error)) {
            const details = error instanceof errorHandler_1.AppError ? error.details : {};
            return sendModelNotAllowed(res, {
                allowedSelections: Array.isArray(details.allowedSelections)
                    ? details.allowedSelections
                    : [ai_service_1.aiService.getDefaultSelection()],
                defaultSelection: typeof details.defaultSelection === "string"
                    ? details.defaultSelection
                    : ai_service_1.aiService.getDefaultSelection(),
            });
        }
        if (isModelCooldownError(error)) {
            return sendModelCooldown(res, getModelCooldownWaitMs(error));
        }
        if (isRateLimitedError(error)) {
            return sendRateLimited(res, getRateLimitRetryAfterMs(error));
        }
        if (isProviderDegradedError(error)) {
            const details = error instanceof errorHandler_1.AppError ? error.details : {};
            return sendProviderDegraded(res, {
                provider: String(details.provider ?? "provider"),
                suggestedModels: Array.isArray(details.suggestedModels)
                    ? details.suggestedModels
                    : [],
            });
        }
        if (error instanceof errorHandler_1.AppError && typeof error.details === "object" && error.details) {
            const details = error.details;
            if (details.error === "PROMPT_BLOCKED") {
                await security_service_1.securityService.logSecurityEvent({
                    userId: req.user?.id,
                    type: "PROMPT_INJECTION_ATTEMPT",
                    route: req.originalUrl,
                    ip: req.ip,
                    userAgent: req.headers["user-agent"],
                    requestId,
                    details,
                });
            }
        }
        await reliability_service_1.reliabilityService.recordRequestFailure(ai_service_1.aiService.normalizeModel(String(req.body.model ?? "openrouter")), 0, error);
        await prisma_1.prisma.aiRequestLog
            .update({
            where: { requestId },
            data: {
                traceId,
                status: "ERROR",
                errorCode: "CHAT_ERROR",
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                latencyMs: Date.now() - requestStartedAtMs,
                finishedAt: new Date(),
            },
        })
            .catch(() => undefined);
        await recordAiUsageEvent({
            userId: req.user?.id,
            provider: ai_service_1.aiService.normalizeModel(String(req.body.model ?? "openrouter")),
            modelName: ai_service_1.aiService.normalizeModel(String(req.body.model ?? "openrouter")),
            status: "ERROR",
            errorCode: "CHAT_ERROR",
        });
        return next(error);
    }
};
exports.postAiChat = postAiChat;
const getAiModels = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const modelAccess = await resolveAllowedModelSelections(req.user.id);
        const modelConfig = ai_service_1.aiService.getModelConfig();
        const billing = await credits_service_1.creditsService.assertCanUseAi(req.user.id).catch(() => null);
        const subscriptionActive = await credits_service_1.creditsService.hasActiveSubscription(req.user.id);
        const modelSelections = modelConfig.models.flatMap((provider) => (modelConfig.providerVersions[provider] ?? []).map((version) => {
            const id = `${provider}:${version}`;
            const versionLabel = version === "plaxe-o1" ? "Euclit O1" : version;
            return {
                id,
                provider,
                version,
                label: versionLabel,
                free: ai_service_1.aiService.isFreeSelection(id),
                locked: !modelAccess.allowedSelections.includes(id),
            };
        }));
        return (0, response_1.sendSuccess)(res, {
            ...modelConfig,
            modelSelections,
            allowedSelections: modelAccess.allowedSelections,
            defaultSelection: modelAccess.defaultSelection,
            subscriptionActive: modelAccess.subscriptionActive,
            billing: billing ?? {
                subscriptionActive,
                credits: await credits_service_1.creditsService.getWalletSummary(req.user.id),
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiModels = getAiModels;
const postAiChatStream = async (req, res, next) => {
    const body = req.body;
    const requestId = parseRequestId(body.requestId);
    const chatId = parseChatId(body.chatId);
    const regeneratedFromRequestId = parseRegeneratedFromRequestId(body.regeneratedFromRequestId);
    const traceId = req.traceId ?? requestId;
    let streamTimeout = null;
    let estimatedTokenBudget = 0;
    let requestStartedAtMs = Date.now();
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const userId = req.user.id;
        if (activeStreamControllers.has(requestId)) {
            throw new errorHandler_1.AppError(409, "requestId is already active");
        }
        const existing = await prisma_1.prisma.aiRequestLog.findUnique({
            where: { requestId },
            select: {
                userId: true,
                status: true,
                charged: true,
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
                costUsd: true,
                model: true,
                provider: true,
            },
        });
        if (existing) {
            if (existing.userId !== req.user.id) {
                throw new errorHandler_1.AppError(409, "requestId already exists for a different user");
            }
            if (existing.status === "RUNNING") {
                throw new errorHandler_1.AppError(409, "Request is already in progress");
            }
            if (existing.status === "OK") {
                return (0, response_1.sendSuccess)(res, {
                    requestId,
                    status: existing.status,
                    charged: existing.charged,
                    usage: {
                        promptTokens: existing.promptTokens,
                        completionTokens: existing.completionTokens,
                        totalTokens: existing.totalTokens,
                    },
                    costUsd: existing.costUsd,
                    model: existing.model,
                    provider: existing.provider,
                }, "Request already processed");
            }
        }
        const guarded = await trace_service_1.traceService.withSpan("ai.context_build", { requestId, traceId, chatId: chatId ?? null, stream: true }, async () => {
            const rawMessages = parseMessages(body.messages);
            return promptGuard_service_1.promptGuardService.enforcePromptGuardrails(rawMessages);
        });
        const messages = guarded.messages;
        if (guarded.risky) {
            await security_service_1.securityService.logSecurityEvent({
                userId,
                type: "PROMPT_INJECTION_ATTEMPT",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                requestId,
                details: { matches: guarded.matches, mode: "stream" },
            });
        }
        const modelAccess = await resolveAllowedModelSelections(userId);
        const rawModel = typeof body.model === "string" && body.model.trim().length > 0
            ? body.model
            : modelAccess.defaultSelection;
        let selected = ai_service_1.aiService.parseModelSelection(rawModel);
        let selectedModel = selected.provider;
        let selectedVersion = selected.version;
        let selectedSelection = selected.selection;
        const allowedSelection = resolveAllowedModelSelection(selectedSelection, modelAccess.allowedSelections, modelAccess.defaultSelection);
        if (allowedSelection !== selectedSelection) {
            selected = ai_service_1.aiService.parseModelSelection(allowedSelection);
            selectedModel = selected.provider;
            selectedVersion = selected.version;
            selectedSelection = selected.selection;
        }
        const originallySelectedModel = selectedModel;
        const temperature = parseTemperature(body.temperature);
        const maxTokens = parseMaxTokens(body.maxTokens);
        await trace_service_1.traceService.withSpan("ai.auth_and_gate", { requestId, traceId }, async () => {
            if (modelAccess.subscriptionActive) {
                await credits_service_1.creditsService.assertCanUseAi(userId);
            }
        });
        estimatedTokenBudget = estimatePromptTokens(messages);
        await enforceAiRateLimit(req, messages);
        enforceModelCooldown(userId, selectedModel);
        const preflight = await reliability_service_1.reliabilityService.checkProviderBeforeRequest(selectedModel);
        if (preflight.blocked) {
            const fallback = await reliability_service_1.reliabilityService.resolveFallbackModel(selectedModel);
            if (fallback.mode === "AUTO" &&
                fallback.fallbackModel &&
                modelAccess.allowedSelections.some((selection) => selection.startsWith(`${fallback.fallbackModel}:`))) {
                console.info(JSON.stringify({
                    event: "ai.provider.auto_fallback",
                    requestId,
                    userId: req.user.id,
                    from: selectedModel,
                    to: fallback.fallbackModel,
                    stream: true,
                }));
                selectedModel = fallback.fallbackModel;
                selectedVersion = ai_service_1.aiService.listProviderVersions(selectedModel)[0];
                selectedSelection = `${selectedModel}:${selectedVersion}`;
            }
            else {
                console.warn(JSON.stringify({
                    event: "ai.provider.degraded_block",
                    requestId,
                    userId: req.user.id,
                    provider: preflight.provider,
                    suggestedModels: filterAllowedSuggestions(fallback.suggestions, modelAccess.allowedSelections),
                    stream: true,
                }));
                if (!res.headersSent) {
                    return sendProviderDegraded(res, {
                        provider: preflight.provider,
                        suggestedModels: filterAllowedSuggestions(fallback.suggestions, modelAccess.allowedSelections),
                    });
                }
            }
        }
        if (existing && (existing.status === "ERROR" || existing.status === "CANCELLED")) {
            await prisma_1.prisma.aiRequestLog.update({
                where: { requestId },
                data: {
                    traceId,
                    chatId,
                    provider: "router",
                    providerModelId: selectedVersion,
                    model: selectedModel,
                    isRegeneration: Boolean(regeneratedFromRequestId),
                    regeneratedFromRequestId,
                    isStream: true,
                    temperature,
                    maxTokens,
                    status: "RUNNING",
                    errorCode: null,
                    errorMessage: null,
                    finishedAt: null,
                    estimatorUsed: false,
                    providerUsageRaw: client_1.Prisma.JsonNull,
                    streamStartedAt: new Date(),
                    firstTokenAt: null,
                    lastTokenAt: null,
                    streamCompletedAt: null,
                    startedAt: new Date(),
                },
            });
        }
        else {
            await prisma_1.prisma.aiRequestLog.create({
                data: {
                    requestId,
                    traceId,
                    userId: req.user.id,
                    chatId,
                    provider: "router",
                    providerModelId: selectedVersion,
                    model: selectedModel,
                    isRegeneration: Boolean(regeneratedFromRequestId),
                    regeneratedFromRequestId,
                    isStream: true,
                    temperature,
                    maxTokens,
                    status: "RUNNING",
                    startedAt: new Date(),
                    streamStartedAt: new Date(),
                },
            });
        }
        const controller = new AbortController();
        streamTimeout = setTimeout(() => {
            controller.abort();
        }, Math.max(5000, env_1.env.AI_STREAM_MAX_DURATION_MS));
        activeStreamControllers.set(requestId, {
            userId: req.user.id,
            controller,
        });
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();
        res.write(`data: ${JSON.stringify({ type: "start", requestId })}\n\n`);
        let firstTokenAt = null;
        let lastTokenAt = null;
        let chunkCount = 0;
        requestStartedAtMs = Date.now();
        const streamResult = await trace_service_1.traceService.withSpan("ai.provider_call", {
            requestId,
            traceId,
            provider: selectedModel,
            model: selectedModel,
            timeoutMs: env_1.env.AI_PROVIDER_TIMEOUT_MS,
            stream: true,
        }, async () => ai_service_1.aiService.streamChatCompletion({
            messages,
            model: selectedModel,
            modelVersion: selectedVersion,
            temperature,
            maxTokens,
            signal: controller.signal,
        }, (token) => {
            const now = new Date();
            if (!firstTokenAt)
                firstTokenAt = now;
            lastTokenAt = now;
            chunkCount += 1;
            res.write(`data: ${JSON.stringify({ type: "chunk", token, requestId })}\n\n`);
        }));
        if (streamTimeout) {
            clearTimeout(streamTimeout);
            streamTimeout = null;
        }
        await reliability_service_1.reliabilityService.recordRequestSuccess(selectedModel, Date.now() - requestStartedAtMs);
        const firstTokenAtMs = firstTokenAt ? firstTokenAt.getTime() : null;
        const lastTokenAtMs = lastTokenAt ? lastTokenAt.getTime() : null;
        const ttftMs = firstTokenAtMs !== null ? firstTokenAtMs - requestStartedAtMs : 0;
        const streamDurationMs = firstTokenAtMs !== null && lastTokenAtMs !== null
            ? lastTokenAtMs - firstTokenAtMs
            : 0;
        console.info(JSON.stringify({
            event: "ai.stream.metrics",
            requestId,
            traceId,
            provider: selectedModel,
            model: selectedModel,
            ttftMs,
            streamDurationMs,
            chunks: chunkCount,
        }));
        const usage = finalizeUsage(streamResult.usage, {
            messages,
            completionText: streamResult.text,
        });
        if (usage.totalTokens < estimatedTokenBudget) {
            await redisRateLimiter_service_1.redisRateLimiterService.refundTokenBudget({
                userId: req.user.id,
                tokens: estimatedTokenBudget - usage.totalTokens,
            });
        }
        const costUsd = calculateCostUsd(usage);
        await trace_service_1.traceService.withSpan("ai.response_write", { requestId, traceId, stream: true }, async () => {
            await prisma_1.prisma.aiRequestLog.update({
                where: { requestId },
                data: {
                    traceId,
                    provider: streamResult.provider,
                    providerModelId: streamResult.providerModelId,
                    model: streamResult.model,
                    status: "OK",
                    retryCount: streamResult.retryCount ?? 0,
                    latencyMs: Date.now() - requestStartedAtMs,
                    ttftMs: ttftMs > 0 ? ttftMs : null,
                    streamDurationMs: streamDurationMs > 0 ? streamDurationMs : null,
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                    estimatorUsed: !Boolean(streamResult.providerUsageRaw),
                    providerUsageRaw: streamResult.providerUsageRaw
                        ? streamResult.providerUsageRaw
                        : undefined,
                    costUsd,
                    firstTokenAt: firstTokenAt ?? undefined,
                    lastTokenAt: lastTokenAt ?? undefined,
                    streamCompletedAt: new Date(),
                    finishedAt: new Date(),
                },
            });
        });
        await recordAiUsageEvent({
            userId: req.user.id,
            provider: streamResult.provider,
            modelName: streamResult.model,
            tokensIn: usage.promptTokens,
            tokensOut: usage.completionTokens,
            costUsd,
            status: "OK",
        });
        const chargeResult = await trace_service_1.traceService.withSpan("ai.billing_charge", { requestId, traceId, stream: true }, async () => credits_service_1.creditsService.chargeForAiRequest(requestId));
        console.info(JSON.stringify({
            event: "ai.stream.ok",
            requestId,
            userId: req.user.id,
            provider: streamResult.provider,
            model: streamResult.model,
            totalTokens: usage.totalTokens,
            latencyMs: Date.now() - requestStartedAtMs,
            retryCount: streamResult.retryCount ?? 0,
            traceId,
            isRegeneration: Boolean(regeneratedFromRequestId),
            charged: chargeResult.charged,
        }));
        res.write(`data: ${JSON.stringify({
            type: "done",
            requestId,
            reply: {
                ...streamResult,
                id: requestId,
                usage,
                costUsd,
                switchedFromModel: originallySelectedModel !== selectedModel ? originallySelectedModel : null,
                switchedToModel: originallySelectedModel !== selectedModel ? selectedModel : null,
            },
        })}\n\n`);
        return res.end();
    }
    catch (error) {
        if (isCreditsRequiredError(error)) {
            console.info(JSON.stringify({
                event: "ai.stream.paywall_block",
                requestId,
                traceId,
                userId: req.user?.id ?? null,
            }));
            await security_service_1.securityService.logSecurityEvent({
                userId: req.user?.id,
                type: "PAYWALL_BLOCK",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                requestId,
                details: { reason: "CREDITS_REQUIRED" },
            });
            if (!res.headersSent) {
                return sendCreditsRequired(res);
            }
            res.write(`data: ${JSON.stringify({
                type: "error",
                error: "CREDITS_REQUIRED",
                message: "Buy credits to use AI models",
                requestId,
            })}\n\n`);
            return res.end();
        }
        if (isModelNotAllowedError(error)) {
            const details = error instanceof errorHandler_1.AppError ? error.details : {};
            if (!res.headersSent) {
                return sendModelNotAllowed(res, {
                    allowedSelections: Array.isArray(details.allowedSelections)
                        ? details.allowedSelections
                        : [ai_service_1.aiService.getDefaultSelection()],
                    defaultSelection: typeof details.defaultSelection === "string"
                        ? details.defaultSelection
                        : ai_service_1.aiService.getDefaultSelection(),
                });
            }
            res.write(`data: ${JSON.stringify({
                type: "error",
                error: "MODEL_NOT_ALLOWED",
                message: "Selected model is available on paid plans only.",
                allowedSelections: Array.isArray(details.allowedSelections)
                    ? details.allowedSelections
                    : [ai_service_1.aiService.getDefaultSelection()],
                defaultSelection: typeof details.defaultSelection === "string"
                    ? details.defaultSelection
                    : ai_service_1.aiService.getDefaultSelection(),
                requestId,
            })}\n\n`);
            return res.end();
        }
        if (isModelCooldownError(error)) {
            const waitMs = getModelCooldownWaitMs(error);
            if (!res.headersSent) {
                return sendModelCooldown(res, waitMs);
            }
            res.write(`data: ${JSON.stringify({
                type: "error",
                error: "MODEL_COOLDOWN",
                message: `Try again in ${Math.max(1, Math.ceil(waitMs / 1000))}s`,
                retryAfterMs: waitMs,
                requestId,
            })}\n\n`);
            return res.end();
        }
        if (isRateLimitedError(error)) {
            const retryAfterMs = getRateLimitRetryAfterMs(error);
            if (!res.headersSent) {
                return sendRateLimited(res, retryAfterMs);
            }
            res.write(`data: ${JSON.stringify({
                type: "error",
                error: "RATE_LIMITED",
                message: `Too many requests. Try again in ${Math.max(1, Math.ceil(retryAfterMs / 1000))} seconds.`,
                retryAfterMs,
                requestId,
            })}\n\n`);
            return res.end();
        }
        if (isProviderDegradedError(error)) {
            const details = error instanceof errorHandler_1.AppError ? error.details : {};
            if (!res.headersSent) {
                return sendProviderDegraded(res, {
                    provider: String(details.provider ?? "provider"),
                    suggestedModels: Array.isArray(details.suggestedModels)
                        ? details.suggestedModels
                        : [],
                });
            }
            res.write(`data: ${JSON.stringify({
                type: "error",
                error: "PROVIDER_DEGRADED",
                message: String(details.message ?? "Selected provider is currently degraded. Choose another model."),
                suggestedModels: Array.isArray(details.suggestedModels)
                    ? details.suggestedModels
                    : [],
                requestId,
            })}\n\n`);
            return res.end();
        }
        await reliability_service_1.reliabilityService.recordRequestFailure(ai_service_1.aiService.normalizeModel(String(req.body.model ?? "openrouter")), 0, error);
        const cancelled = isAbortError(error);
        if (cancelled) {
            if (estimatedTokenBudget > 0) {
                await redisRateLimiter_service_1.redisRateLimiterService.refundTokenBudget({
                    userId: req.user?.id ?? "",
                    tokens: estimatedTokenBudget,
                });
            }
            await prisma_1.prisma.aiRequestLog
                .update({
                where: { requestId },
                data: {
                    traceId,
                    status: "CANCELLED",
                    latencyMs: Date.now() - requestStartedAtMs,
                    finishedAt: new Date(),
                },
            })
                .catch(() => undefined);
            if (!res.headersSent) {
                return (0, response_1.sendSuccess)(res, { requestId, status: "CANCELLED" }, "Stream cancelled");
            }
            res.write(`data: ${JSON.stringify({ type: "cancelled", requestId })}\n\n`);
            return res.end();
        }
        await prisma_1.prisma.aiRequestLog
            .update({
            where: { requestId },
            data: {
                traceId,
                status: "ERROR",
                errorCode: "STREAM_ERROR",
                errorMessage: error instanceof Error ? error.message : "Streaming failed",
                latencyMs: Date.now() - requestStartedAtMs,
                finishedAt: new Date(),
            },
        })
            .catch(() => undefined);
        await recordAiUsageEvent({
            userId: req.user?.id,
            provider: ai_service_1.aiService.normalizeModel(String(req.body.model ?? "openrouter")),
            modelName: ai_service_1.aiService.normalizeModel(String(req.body.model ?? "openrouter")),
            status: "ERROR",
            errorCode: "STREAM_ERROR",
        });
        if (estimatedTokenBudget > 0) {
            await redisRateLimiter_service_1.redisRateLimiterService.refundTokenBudget({
                userId: req.user?.id ?? "",
                tokens: estimatedTokenBudget,
            });
        }
        if (!res.headersSent) {
            return next(error);
        }
        const message = error instanceof Error ? error.message : "Streaming failed";
        res.write(`data: ${JSON.stringify({ type: "error", message, requestId })}\n\n`);
        return res.end();
    }
    finally {
        if (streamTimeout) {
            clearTimeout(streamTimeout);
        }
        activeStreamControllers.delete(requestId);
    }
};
exports.postAiChatStream = postAiChatStream;
const getProviderHealth = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const providers = await reliability_service_1.reliabilityService.getAllProviderHealth();
        return (0, response_1.sendSuccess)(res, { providers });
    }
    catch (error) {
        return next(error);
    }
};
exports.getProviderHealth = getProviderHealth;
const cancelAiChatStream = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const requestId = String(req.params.requestId ?? "").trim();
        if (!requestId)
            throw new errorHandler_1.AppError(400, "requestId is required");
        const log = await prisma_1.prisma.aiRequestLog.findUnique({
            where: { requestId },
            select: {
                userId: true,
                status: true,
            },
        });
        if (!log)
            throw new errorHandler_1.AppError(404, "requestId not found");
        if (log.userId !== req.user.id)
            throw new errorHandler_1.AppError(403, "Forbidden");
        const active = activeStreamControllers.get(requestId);
        if (!active) {
            return (0, response_1.sendSuccess)(res, { requestId, status: log.status, cancelled: false }, "Request already finished");
        }
        active.controller.abort();
        await prisma_1.prisma.aiRequestLog.update({
            where: { requestId },
            data: {
                status: "CANCELLED",
                finishedAt: new Date(),
            },
        });
        return (0, response_1.sendSuccess)(res, { requestId, status: "CANCELLED", cancelled: true }, "Cancellation requested");
    }
    catch (error) {
        return next(error);
    }
};
exports.cancelAiChatStream = cancelAiChatStream;
const getAiAdminConfig = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const config = await loadAiConfigRow();
        return (0, response_1.sendSuccess)(res, { ...ai_service_1.aiService.getAdminConfig(), persisted: config });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiAdminConfig = getAiAdminConfig;
const patchAiAdminConfig = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const reason = String(req.body?.reason ?? "").trim();
        if (!reason) {
            throw new errorHandler_1.AppError(400, "reason is required for config updates");
        }
        const body = (req.body ?? {});
        const before = await loadAiConfigRow();
        if (body.enabledModels && typeof body.enabledModels === "object") {
            const models = Object.keys(body.enabledModels);
            for (const model of models) {
                const value = body.enabledModels[model];
                if (typeof value === "boolean") {
                    ai_service_1.aiService.setModelEnabled(model, value);
                }
            }
        }
        if (body.multipliers && typeof body.multipliers === "object") {
            const models = Object.keys(body.multipliers);
            for (const model of models) {
                const value = body.multipliers[model];
                if (typeof value === "number") {
                    ai_service_1.aiService.setModelMultiplier(model, value);
                }
            }
        }
        const afterRuntime = ai_service_1.aiService.getAdminConfig();
        const after = await prisma_1.prisma.aiConfig.update({
            where: { id: "singleton" },
            data: {
                enabledModels: afterRuntime.enabledModels,
                multipliers: afterRuntime.multipliers,
                limits: before.limits,
                cooldowns: before.cooldowns,
                version: before.version + 1,
            },
        });
        const diff = {
            enabledModels: body.enabledModels ?? {},
            multipliers: body.multipliers ?? {},
        };
        await security_service_1.securityService.createConfigAuditLog({
            actorUserId: req.user.id,
            action: "AI_CONFIG_UPDATE",
            before: {
                enabledModels: before.enabledModels,
                multipliers: before.multipliers,
                limits: before.limits,
                cooldowns: before.cooldowns,
                version: before.version,
            },
            after,
            diff,
            reason,
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            requestId: String(req.body?.requestId ?? "").trim() ||
                `cfg-${Date.now()}`,
            configVersion: after.version,
        });
        console.info(JSON.stringify({
            event: "ai.admin.config.updated",
            actorUserId: req.user.id,
            changes: body,
            at: new Date().toISOString(),
        }));
        return (0, response_1.sendSuccess)(res, { ...afterRuntime, persisted: after }, "AI admin config updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchAiAdminConfig = patchAiAdminConfig;
const verifyAuditChain = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const result = await security_service_1.securityService.verifyAuditChain();
        if (!result.ok) {
            await security_service_1.securityService.logSecurityEvent({
                userId: req.user.id,
                type: "AUDIT_CHAIN_FAILURE",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                details: result,
            });
        }
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        return next(error);
    }
};
exports.verifyAuditChain = verifyAuditChain;
