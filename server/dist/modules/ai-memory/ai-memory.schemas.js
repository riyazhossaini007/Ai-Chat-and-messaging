"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWithZod = exports.semanticSearchSchema = exports.contextRespondSchema = exports.groupInsightQuerySchema = exports.memorySearchSchema = exports.memoryForgetSchema = exports.memoryPinSchema = exports.knowledgePatchSchema = exports.knowledgeListSchema = exports.knowledgeExtractSchema = exports.CONTEXT_MODES = exports.KNOWLEDGE_TYPES = void 0;
const zod_1 = require("zod");
const errorHandler_1 = require("../../middlewares/errorHandler");
exports.KNOWLEDGE_TYPES = [
    "SUMMARY",
    "TASK",
    "DECISION",
    "IDEA",
    "FACT",
    "FOLLOW_UP",
    "MEETING_NOTE",
    "ISSUE",
    "RISK",
    "MILESTONE",
];
exports.CONTEXT_MODES = [
    "SUMMARIZE",
    "ANSWER_QUESTION",
    "EXTRACT_TASKS",
    "EXPLAIN",
    "SEARCH_MEMORY",
    "PROJECT_UPDATE",
];
const nonEmptyString = zod_1.z.string().trim().min(1);
exports.knowledgeExtractSchema = zod_1.z
    .object({
    chatId: zod_1.z.string().trim().min(1).optional(),
    groupId: zod_1.z.string().trim().min(1).optional(),
    messageIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(50).optional(),
    fileIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(50).optional(),
    knowledgeType: zod_1.z.enum(exports.KNOWLEDGE_TYPES).optional(),
    title: zod_1.z.string().trim().max(160).optional(),
    summary: zod_1.z.string().trim().max(500).optional(),
    saveToMemory: zod_1.z.boolean().optional(),
    mode: zod_1.z.enum(["manual", "auto"]).optional(),
})
    .strict();
exports.knowledgeListSchema = zod_1.z
    .object({
    chatId: zod_1.z.string().trim().optional(),
    groupId: zod_1.z.string().trim().optional(),
    reviewState: zod_1.z.enum(["PENDING", "CONFIRMED", "DISMISSED"]).optional(),
    type: zod_1.z.enum(exports.KNOWLEDGE_TYPES).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional(),
})
    .strict();
exports.knowledgePatchSchema = zod_1.z
    .object({
    reviewState: zod_1.z.enum(["PENDING", "CONFIRMED", "DISMISSED"]).optional(),
    tags: zod_1.z.array(zod_1.z.string().trim().min(1).max(32)).max(20).optional(),
})
    .strict()
    .refine((value) => value.reviewState !== undefined || value.tags !== undefined, {
    message: "At least one field is required",
});
exports.memoryPinSchema = zod_1.z.object({ memoryId: nonEmptyString }).strict();
exports.memoryForgetSchema = zod_1.z
    .object({
    memoryId: zod_1.z.string().trim().min(1).optional(),
    topic: zod_1.z.string().trim().min(1).max(80).optional(),
})
    .strict()
    .refine((value) => Boolean(value.memoryId || value.topic), {
    message: "memoryId or topic is required",
});
exports.memorySearchSchema = zod_1.z
    .object({
    q: zod_1.z.string().trim().optional(),
    pinned: zod_1.z.coerce.boolean().optional(),
    recent: zod_1.z.coerce.boolean().optional(),
    topic: zod_1.z.string().trim().optional(),
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(50).optional(),
})
    .strict();
exports.groupInsightQuerySchema = zod_1.z
    .object({
    limit: zod_1.z.coerce.number().int().min(1).max(50).optional(),
})
    .strict();
exports.contextRespondSchema = zod_1.z
    .object({
    chatId: zod_1.z.string().trim().min(1).optional(),
    groupId: zod_1.z.string().trim().min(1).optional(),
    selectedMessageId: zod_1.z.string().trim().min(1).optional(),
    query: zod_1.z.string().trim().min(1).max(2000),
    mode: zod_1.z.enum(exports.CONTEXT_MODES),
    pinnedMemoryIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(20).optional(),
    tokenBudget: zod_1.z.coerce.number().int().min(256).max(6000).optional(),
    model: zod_1.z.string().trim().optional(),
})
    .strict()
    .refine((value) => Boolean(value.chatId || value.groupId || value.selectedMessageId), {
    message: "chatId, groupId, or selectedMessageId is required",
});
exports.semanticSearchSchema = zod_1.z
    .object({
    q: zod_1.z.string().trim().min(1).max(300),
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
    person: zod_1.z.string().trim().optional(),
    chatId: zod_1.z.string().trim().optional(),
    groupId: zod_1.z.string().trim().optional(),
    type: zod_1.z.enum(["message", "file", "knowledge", "memory", "decision", "task"]).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(50).optional(),
})
    .strict();
const parseWithZod = (schema, value) => {
    try {
        return schema.parse(value);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            throw new errorHandler_1.AppError(400, error.issues[0]?.message ?? "Validation failed");
        }
        throw error;
    }
};
exports.parseWithZod = parseWithZod;
