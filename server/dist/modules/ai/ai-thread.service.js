"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiThreadService = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const chat_service_1 = require("../chat/chat.service");
const message_service_1 = require("../message/message.service");
const ai_thread_command_1 = require("./ai-thread.command");
const ai_thread_queue_1 = require("./ai-thread.queue");
const ai_thread_rate_limit_1 = require("./ai-thread.rate-limit");
const credits_service_1 = require("../credits/credits.service");
const MAX_PROMPT_LENGTH = 2000;
const MAX_CONTEXT_MESSAGES = 60;
const prismaAny = prisma_1.prisma;
const sanitizeText = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toTurnPayload = (turn) => ({
    id: turn.id,
    threadId: turn.threadId,
    role: turn.role === "USER" ? "USER" : "AI",
    content: turn.content,
    meta: turn.meta && typeof turn.meta === "object" ? turn.meta : null,
    createdAt: turn.createdAt.toISOString(),
});
const assertThreadOwner = async (requesterId, threadId) => {
    const thread = await prismaAny.aiThread.findUnique({
        where: { id: threadId },
    });
    if (!thread)
        throw new errorHandler_1.AppError(404, "AI thread not found");
    if (thread.requesterId !== requesterId)
        throw new errorHandler_1.AppError(403, "Forbidden");
    await chat_service_1.chatService.assertParticipant(requesterId, thread.chatId);
    return thread;
};
const nonEmptyString = zod_1.z.string().trim().min(1);
const threadIdSchema = nonEmptyString;
const aiTurnIdSchema = nonEmptyString;
const createThreadBodySchema = zod_1.z
    .object({
    chatId: nonEmptyString,
    targetMessageId: zod_1.z
        .union([zod_1.z.string().trim().min(1), zod_1.z.literal(""), zod_1.z.null()])
        .optional()
        .transform((value) => (value ? value : null)),
})
    .strict();
const createTurnBodySchema = zod_1.z
    .object({
    prompt: zod_1.z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
    commandHint: zod_1.z.enum(["SUMMARIZE", "EXPLAIN", "TRANSLATE", "GENERAL"]).optional(),
    translateTo: zod_1.z.string().trim().min(1).max(64).optional(),
})
    .strict();
const shareBodySchema = zod_1.z
    .object({
    aiTurnId: aiTurnIdSchema,
})
    .strict();
const forwardBodySchema = zod_1.z
    .object({
    aiTurnId: aiTurnIdSchema,
    toChatId: nonEmptyString,
})
    .strict();
const parseWithZod = (schema, value) => {
    try {
        return schema.parse(value);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            const message = error.issues[0]?.message ?? "Validation failed";
            throw new errorHandler_1.AppError(400, message);
        }
        throw error;
    }
};
const parseCreateThreadBody = (body) => parseWithZod(createThreadBodySchema, body);
const parseCreateTurnBody = (body) => parseWithZod(createTurnBodySchema, body);
const parseShareBody = (body) => parseWithZod(shareBodySchema, body);
const parseForwardBody = (body) => parseWithZod(forwardBodySchema, body);
const parseThreadId = (value) => parseWithZod(threadIdSchema, value);
exports.aiThreadService = {
    parseCreateThreadBody,
    parseCreateTurnBody,
    parseShareBody,
    parseForwardBody,
    parseThreadId,
    async createOrReuseThread(input) {
        await chat_service_1.chatService.assertParticipant(input.requesterId, input.chatId);
        if (input.targetMessageId) {
            const target = await prismaAny.message.findUnique({
                where: { id: input.targetMessageId },
                select: { id: true, chatId: true },
            });
            if (!target || target.chatId !== input.chatId) {
                throw new errorHandler_1.AppError(404, "Target message not found in chat");
            }
        }
        const existing = await prismaAny.aiThread.findFirst({
            where: {
                chatId: input.chatId,
                requesterId: input.requesterId,
                targetMessageId: input.targetMessageId ?? null,
            },
            orderBy: { createdAt: "desc" },
            include: {
                turns: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });
        if (existing)
            return { threadId: existing.id, thread: existing };
        const thread = await prismaAny.aiThread.create({
            data: {
                chatId: input.chatId,
                requesterId: input.requesterId,
                targetMessageId: input.targetMessageId ?? null,
            },
            include: {
                turns: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });
        return { threadId: thread.id, thread };
    },
    async getThread(input) {
        const thread = await assertThreadOwner(input.requesterId, input.threadId);
        const turns = await prismaAny.aiTurn.findMany({
            where: { threadId: thread.id },
            orderBy: { createdAt: "asc" },
        });
        const target = thread.targetMessageId
            ? await prismaAny.message.findUnique({
                where: { id: thread.targetMessageId },
                select: {
                    id: true,
                    senderId: true,
                    type: true,
                    content: true,
                    text: true,
                    mediaUrl: true,
                    deletedForEveryone: true,
                    mediaMetadata: {
                        select: {
                            id: true,
                            kind: true,
                            url: true,
                            sizeBytes: true,
                        },
                    },
                },
            })
            : null;
        const targetMessage = target
            ? {
                id: target.id,
                senderId: target.senderId,
                type: target.type,
                content: target.deletedForEveryone ? null : target.content ?? target.text ?? null,
                attachments: target.mediaMetadata,
                unavailable: target.deletedForEveryone,
            }
            : thread.targetMessageId
                ? {
                    id: thread.targetMessageId,
                    senderId: null,
                    type: "TEXT",
                    content: null,
                    attachments: [],
                    unavailable: true,
                }
                : null;
        return {
            thread: {
                ...thread,
                turns,
            },
            turns: turns.map(toTurnPayload),
            targetMessage,
        };
    },
    async createTurnAndEnqueue(input) {
        const thread = await assertThreadOwner(input.requesterId, input.threadId);
        const subscriptionActive = await credits_service_1.creditsService.hasActiveSubscription(input.requesterId);
        await (0, ai_thread_rate_limit_1.enforceAiThreadRateLimit)({
            requesterId: input.requesterId,
            subscriptionActive,
        });
        const parsed = (0, ai_thread_command_1.parseAiCommand)({
            prompt: input.prompt,
            commandHint: input.commandHint,
            translateTo: input.translateTo,
        });
        const output = await prismaAny.$transaction(async (tx) => {
            const userTurn = await tx.aiTurn.create({
                data: {
                    threadId: thread.id,
                    role: "USER",
                    content: sanitizeText(parsed.normalizedPrompt),
                },
            });
            const aiPlaceholder = await tx.aiTurn.create({
                data: {
                    threadId: thread.id,
                    role: "AI",
                    content: "Thinking...",
                    meta: {
                        status: "QUEUED",
                    },
                },
            });
            const jobInput = {
                threadId: thread.id,
                userTurnId: userTurn.id,
                aiTurnId: aiPlaceholder.id,
                chatId: thread.chatId,
                targetMessageId: thread.targetMessageId,
                commandType: parsed.commandType,
                translateTo: parsed.translateTo,
                prompt: parsed.normalizedPrompt,
                contextWindow: {
                    before: MAX_CONTEXT_MESSAGES / 2,
                    after: MAX_CONTEXT_MESSAGES / 2,
                },
            };
            const job = await tx.aiJob.create({
                data: {
                    threadId: thread.id,
                    requesterId: thread.requesterId,
                    type: parsed.commandType,
                    status: "QUEUED",
                    input: jobInput,
                },
            });
            const updatedAi = await tx.aiTurn.update({
                where: { id: aiPlaceholder.id },
                data: {
                    meta: {
                        status: "QUEUED",
                        jobId: job.id,
                    },
                },
            });
            await tx.aiThread.update({
                where: { id: thread.id },
                data: {
                    updatedAt: new Date(),
                },
            });
            return {
                userTurn,
                aiTurnPlaceholder: updatedAi,
                job,
            };
        });
        ai_thread_queue_1.aiThreadQueue.enqueue(output.job.id);
        return {
            thread,
            userTurn: toTurnPayload(output.userTurn),
            aiTurnPlaceholder: toTurnPayload(output.aiTurnPlaceholder),
            jobId: output.job.id,
        };
    },
    async shareAiTurnToThreadChat(input) {
        const thread = await assertThreadOwner(input.requesterId, input.threadId);
        const turn = await prismaAny.aiTurn.findUnique({
            where: { id: input.aiTurnId },
        });
        if (!turn || turn.threadId !== thread.id || turn.role !== "AI") {
            throw new errorHandler_1.AppError(404, "AI turn not found");
        }
        const message = await message_service_1.messageService.createMessage({
            userId: input.requesterId,
            chatId: thread.chatId,
            content: turn.content,
            type: "TEXT",
            meta: {
                sharedFromAiThreadId: thread.id,
                sharedFromAiTurnId: turn.id,
                targetMessageId: thread.targetMessageId ?? null,
            },
        });
        return { thread, turn, message };
    },
    async forwardAiTurnToChat(input) {
        const thread = await assertThreadOwner(input.requesterId, input.threadId);
        await chat_service_1.chatService.assertParticipant(input.requesterId, input.toChatId);
        const turn = await prismaAny.aiTurn.findUnique({
            where: { id: input.aiTurnId },
        });
        if (!turn || turn.threadId !== thread.id || turn.role !== "AI") {
            throw new errorHandler_1.AppError(404, "AI turn not found");
        }
        const message = await message_service_1.messageService.createMessage({
            userId: input.requesterId,
            chatId: input.toChatId,
            content: turn.content,
            type: "TEXT",
            meta: {
                sharedFromAiThreadId: thread.id,
                sharedFromAiTurnId: turn.id,
                targetMessageId: thread.targetMessageId ?? null,
                forwardedFromAiPanel: true,
            },
        });
        return { thread, turn, message };
    },
};
