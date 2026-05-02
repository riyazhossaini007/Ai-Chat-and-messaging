"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAiJob = void 0;
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const messageCrypto_1 = require("../../security/messageCrypto");
const chatEncryption_service_1 = require("../../security/chatEncryption.service");
const socket_1 = require("../../socket");
const credits_service_1 = require("../credits/credits.service");
const ai_service_1 = require("./ai.service");
const FRIENDLY_ATTACHMENT_ERROR = "I can't read this file yet. Please upload text or use supported formats.";
const sanitizeText = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const estimateTokensFromText = (value) => Math.max(1, Math.ceil(value.trim().length / 4));
const calculateCostUsd = (promptTokens, completionTokens) => {
    const promptCost = (promptTokens / 1000) * 0.001;
    const completionCost = (completionTokens / 1000) * 0.002;
    return Number((promptCost + completionCost).toFixed(8));
};
const resolveModelForUser = async (requesterId) => {
    const hasPaid = await credits_service_1.creditsService.hasActiveSubscription(requesterId);
    const preferred = hasPaid ? "openai" : "openrouter";
    const enabled = ai_service_1.aiService.listEnabledModels();
    if (enabled.includes(preferred))
        return preferred;
    return enabled[0] ?? "openrouter";
};
const getMessagePlainText = async (input) => {
    if (input.cipherText && input.iv && input.authTag) {
        const chatDek = await (0, chatEncryption_service_1.getChatDek)(input.chatId);
        if (!chatDek?.dek)
            return null;
        try {
            return (0, messageCrypto_1.decryptText)({
                cipherTextB64: input.cipherText,
                ivB64: input.iv,
                authTagB64: input.authTag,
                algo: "A256GCM",
            }, chatDek.dek);
        }
        catch {
            return null;
        }
    }
    return input.content ?? input.text ?? null;
};
const buildSystemPrompt = (input) => {
    if (input.commandType === "SUMMARIZE") {
        return [
            "You summarize a targeted chat message and nearby context.",
            "Return sections: TL;DR, Key Points, Action Items.",
            "Keep it concise and factual.",
        ].join("\n");
    }
    if (input.commandType === "EXPLAIN") {
        return [
            "You explain the targeted chat message clearly for a non-expert.",
            "Return sections: Explanation, Why it matters, Example.",
            "Avoid jargon when possible.",
        ].join("\n");
    }
    if (input.commandType === "TRANSLATE") {
        return [
            "You translate the targeted message accurately.",
            "Output translation only unless user asked otherwise.",
            `Target language: ${input.translateTo ?? "auto-detected from request"}.`,
        ].join("\n");
    }
    return [
        "You are an assistant answering questions about a targeted chat message.",
        "Prioritize the targeted message and use nearby context only when needed.",
    ].join("\n");
};
const createPromptBody = (input) => {
    const targetBlock = input.targetMessage
        ? [
            `Target Message ID: ${input.targetMessage.id}`,
            `Target Sender: ${input.targetMessage.senderId ?? "unknown"}`,
            `Target Type: ${input.targetMessage.type}`,
            `Target Content: ${input.targetMessage.content ?? "[No text content]"}`,
        ].join("\n")
        : "Target message unavailable.";
    const contextBlock = input.contextMessages.length === 0
        ? "No additional context."
        : input.contextMessages
            .map((item) => `- (${item.id}) ${item.senderId ?? "unknown"}: ${(item.content ?? "").slice(0, 500)}`)
            .join("\n");
    const translation = input.translateTo ? `\nTranslate target language: ${input.translateTo}` : "";
    return [
        targetBlock,
        "",
        "Nearby Context:",
        contextBlock,
        "",
        `User Prompt: ${input.userPrompt}`,
        translation,
    ]
        .join("\n")
        .trim();
};
const toTurnPayload = (turn) => ({
    id: turn.id,
    threadId: turn.threadId,
    role: turn.role === "USER" ? "USER" : "AI",
    content: turn.content,
    meta: turn.meta && typeof turn.meta === "object" ? turn.meta : null,
    createdAt: turn.createdAt.toISOString(),
});
const prismaAny = prisma_1.prisma;
const processAiJob = async (jobId) => {
    const job = await prismaAny.aiJob.findUnique({
        where: { id: jobId },
    });
    if (!job)
        return;
    const input = job.input;
    await prismaAny.aiJob.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
    });
    try {
        const thread = await prismaAny.aiThread.findUnique({
            where: { id: input.threadId },
        });
        if (!thread)
            throw new errorHandler_1.AppError(404, "AI thread not found");
        const target = input.targetMessageId
            ? await prismaAny.message.findUnique({
                where: { id: input.targetMessageId },
                select: {
                    id: true,
                    senderId: true,
                    type: true,
                    mediaUrl: true,
                    content: true,
                    text: true,
                    cipherText: true,
                    iv: true,
                    authTag: true,
                    deletedForEveryone: true,
                },
            })
            : null;
        const targetContent = target && !target.deletedForEveryone
            ? await getMessagePlainText({
                chatId: input.chatId,
                content: target.content,
                text: target.text,
                cipherText: target.cipherText,
                iv: target.iv,
                authTag: target.authTag,
            })
            : null;
        const unsupportedAttachment = Boolean(target?.mediaUrl) && (!targetContent || !targetContent.trim());
        if (unsupportedAttachment) {
            const failedTurn = await prismaAny.aiTurn.update({
                where: { id: input.aiTurnId },
                data: {
                    content: FRIENDLY_ATTACHMENT_ERROR,
                    meta: {
                        status: "FAILED",
                        reason: "UNSUPPORTED_ATTACHMENT",
                    },
                },
            });
            await prismaAny.aiJob.update({
                where: { id: jobId },
                data: {
                    status: "FAILED",
                    error: "UNSUPPORTED_ATTACHMENT",
                    result: {
                        status: "FAILED",
                    },
                },
            });
            (0, socket_1.emitAiTurnUpdatedToUser)(thread.requesterId, {
                threadId: thread.id,
                turn: toTurnPayload(failedTurn),
            });
            (0, socket_1.emitAiThreadUpdatedToUser)(thread.requesterId, {
                threadId: thread.id,
                updatedAt: new Date().toISOString(),
            });
            return;
        }
        const contextRows = await prismaAny.message.findMany({
            where: {
                chatId: input.chatId,
                deletedForEveryone: false,
            },
            orderBy: { createdAt: "desc" },
            take: Math.max(30, Math.min(input.contextWindow.before + input.contextWindow.after, 80)),
            select: {
                id: true,
                senderId: true,
                content: true,
                text: true,
                cipherText: true,
                iv: true,
                authTag: true,
            },
        });
        const contextMessages = (await Promise.all(contextRows.map(async (row) => ({
            id: row.id,
            senderId: row.senderId,
            content: await getMessagePlainText({
                chatId: input.chatId,
                content: row.content,
                text: row.text,
                cipherText: row.cipherText,
                iv: row.iv,
                authTag: row.authTag,
            }),
        })))).reverse();
        const aiMessages = [
            {
                role: "system",
                content: buildSystemPrompt({
                    commandType: input.commandType,
                    translateTo: input.translateTo,
                }),
            },
            {
                role: "user",
                content: createPromptBody({
                    targetMessage: target
                        ? {
                            id: target.id,
                            senderId: target.senderId,
                            type: target.type,
                            content: targetContent,
                            mediaUrl: target.mediaUrl,
                        }
                        : null,
                    contextMessages,
                    userPrompt: input.prompt,
                    translateTo: input.translateTo,
                }),
            },
        ];
        const selectedModel = await resolveModelForUser(thread.requesterId);
        const selectedVersion = ai_service_1.aiService.listProviderVersions(selectedModel)[0];
        const completion = await ai_service_1.aiService.createChatCompletion({
            model: selectedModel,
            modelVersion: selectedVersion,
            messages: aiMessages,
            temperature: 0.3,
            maxTokens: 900,
        });
        const promptTokens = completion.usage.promptTokens || estimateTokensFromText(aiMessages[1]?.content ?? "");
        const completionTokens = completion.usage.completionTokens || estimateTokensFromText(completion.text);
        const costUsd = calculateCostUsd(promptTokens, completionTokens);
        const updatedTurn = await prismaAny.aiTurn.update({
            where: { id: input.aiTurnId },
            data: {
                content: sanitizeText(completion.text.trim()),
                meta: {
                    status: "DONE",
                    model: completion.providerModelId,
                    provider: completion.provider,
                    tokens: {
                        promptTokens,
                        completionTokens,
                        totalTokens: promptTokens + completionTokens,
                    },
                    costUsd,
                },
            },
        });
        await prismaAny.aiJob.update({
            where: { id: jobId },
            data: {
                status: "DONE",
                result: {
                    model: completion.providerModelId,
                    provider: completion.provider,
                    usage: completion.usage,
                    costUsd,
                },
            },
        });
        (0, socket_1.emitAiTurnUpdatedToUser)(thread.requesterId, {
            threadId: thread.id,
            turn: toTurnPayload(updatedTurn),
        });
        (0, socket_1.emitAiThreadUpdatedToUser)(thread.requesterId, {
            threadId: thread.id,
            updatedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message.slice(0, 300) : "AI processing failed";
        const failedTurn = await prismaAny.aiTurn.update({
            where: { id: input.aiTurnId },
            data: {
                content: "I couldn't generate a response right now. Please try again.",
                meta: {
                    status: "FAILED",
                },
            },
        });
        const thread = await prismaAny.aiThread.findUnique({ where: { id: input.threadId } });
        await prismaAny.aiJob.update({
            where: { id: jobId },
            data: {
                status: "FAILED",
                error: errorMessage,
            },
        });
        if (thread) {
            (0, socket_1.emitAiTurnUpdatedToUser)(thread.requesterId, {
                threadId: thread.id,
                turn: toTurnPayload(failedTurn),
            });
            (0, socket_1.emitAiThreadUpdatedToUser)(thread.requesterId, {
                threadId: thread.id,
                updatedAt: new Date().toISOString(),
            });
        }
    }
};
exports.processAiJob = processAiJob;
