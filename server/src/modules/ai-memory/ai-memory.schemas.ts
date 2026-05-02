import { z, ZodError } from "zod";
import { AppError } from "../../middlewares/errorHandler";

export const KNOWLEDGE_TYPES = [
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
] as const;

export const CONTEXT_MODES = [
  "SUMMARIZE",
  "ANSWER_QUESTION",
  "EXTRACT_TASKS",
  "EXPLAIN",
  "SEARCH_MEMORY",
  "PROJECT_UPDATE",
] as const;

const nonEmptyString = z.string().trim().min(1);

export const knowledgeExtractSchema = z
  .object({
    chatId: z.string().trim().min(1).optional(),
    groupId: z.string().trim().min(1).optional(),
    messageIds: z.array(z.string().trim().min(1)).max(50).optional(),
    fileIds: z.array(z.string().trim().min(1)).max(50).optional(),
    knowledgeType: z.enum(KNOWLEDGE_TYPES).optional(),
    title: z.string().trim().max(160).optional(),
    summary: z.string().trim().max(500).optional(),
    saveToMemory: z.boolean().optional(),
    mode: z.enum(["manual", "auto"]).optional(),
  })
  .strict();

export const knowledgeListSchema = z
  .object({
    chatId: z.string().trim().optional(),
    groupId: z.string().trim().optional(),
    reviewState: z.enum(["PENDING", "CONFIRMED", "DISMISSED"]).optional(),
    type: z.enum(KNOWLEDGE_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const knowledgePatchSchema = z
  .object({
    reviewState: z.enum(["PENDING", "CONFIRMED", "DISMISSED"]).optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  })
  .strict()
  .refine((value) => value.reviewState !== undefined || value.tags !== undefined, {
    message: "At least one field is required",
  });

export const memoryPinSchema = z.object({ memoryId: nonEmptyString }).strict();

export const memoryForgetSchema = z
  .object({
    memoryId: z.string().trim().min(1).optional(),
    topic: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.memoryId || value.topic), {
    message: "memoryId or topic is required",
  });

export const memorySearchSchema = z
  .object({
    q: z.string().trim().optional(),
    pinned: z.coerce.boolean().optional(),
    recent: z.coerce.boolean().optional(),
    topic: z.string().trim().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const groupInsightQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const contextRespondSchema = z
  .object({
    chatId: z.string().trim().min(1).optional(),
    groupId: z.string().trim().min(1).optional(),
    selectedMessageId: z.string().trim().min(1).optional(),
    query: z.string().trim().min(1).max(2000),
    mode: z.enum(CONTEXT_MODES),
    pinnedMemoryIds: z.array(z.string().trim().min(1)).max(20).optional(),
    tokenBudget: z.coerce.number().int().min(256).max(6000).optional(),
    model: z.string().trim().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.chatId || value.groupId || value.selectedMessageId), {
    message: "chatId, groupId, or selectedMessageId is required",
  });

export const semanticSearchSchema = z
  .object({
    q: z.string().trim().min(1).max(300),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    person: z.string().trim().optional(),
    chatId: z.string().trim().optional(),
    groupId: z.string().trim().optional(),
    type: z.enum(["message", "file", "knowledge", "memory", "decision", "task"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const parseWithZod = <T>(schema: z.ZodType<T>, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, error.issues[0]?.message ?? "Validation failed");
    }
    throw error;
  }
};
