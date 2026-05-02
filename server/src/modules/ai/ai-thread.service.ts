import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { chatService } from "../chat/chat.service";
import { messageService } from "../message/message.service";
import { parseAiCommand } from "./ai-thread.command";
import { aiThreadQueue } from "./ai-thread.queue";
import { enforceAiThreadRateLimit } from "./ai-thread.rate-limit";
import type { AiJobInput } from "./ai-thread.types";
import { creditsService } from "../credits/credits.service";

const MAX_PROMPT_LENGTH = 2_000;
const MAX_CONTEXT_MESSAGES = 60;

const prismaAny = prisma as any;

const sanitizeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const toTurnPayload = (turn: {
  id: string;
  threadId: string;
  role: string;
  content: string;
  meta: unknown;
  createdAt: Date;
}) => ({
  id: turn.id,
  threadId: turn.threadId,
  role: turn.role === "USER" ? ("USER" as const) : ("AI" as const),
  content: turn.content,
  meta: turn.meta && typeof turn.meta === "object" ? (turn.meta as Record<string, unknown>) : null,
  createdAt: turn.createdAt.toISOString(),
});

const assertThreadOwner = async (requesterId: string, threadId: string) => {
  const thread = await prismaAny.aiThread.findUnique({
    where: { id: threadId },
  });
  if (!thread) throw new AppError(404, "AI thread not found");
  if (thread.requesterId !== requesterId) throw new AppError(403, "Forbidden");
  await chatService.assertParticipant(requesterId, thread.chatId);
  return thread;
};

const nonEmptyString = z.string().trim().min(1);
const threadIdSchema = nonEmptyString;
const aiTurnIdSchema = nonEmptyString;
const createThreadBodySchema = z
  .object({
    chatId: nonEmptyString,
    targetMessageId: z
      .union([z.string().trim().min(1), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .strict();
const createTurnBodySchema = z
  .object({
    prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
    commandHint: z.enum(["SUMMARIZE", "EXPLAIN", "TRANSLATE", "GENERAL"]).optional(),
    translateTo: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
const shareBodySchema = z
  .object({
    aiTurnId: aiTurnIdSchema,
  })
  .strict();
const forwardBodySchema = z
  .object({
    aiTurnId: aiTurnIdSchema,
    toChatId: nonEmptyString,
  })
  .strict();

const parseWithZod = <T>(schema: z.ZodType<T>, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Validation failed";
      throw new AppError(400, message);
    }
    throw error;
  }
};

const parseCreateThreadBody = (body: unknown) => parseWithZod(createThreadBodySchema, body);
const parseCreateTurnBody = (body: unknown) => parseWithZod(createTurnBodySchema, body);
const parseShareBody = (body: unknown) => parseWithZod(shareBodySchema, body);
const parseForwardBody = (body: unknown) => parseWithZod(forwardBodySchema, body);
const parseThreadId = (value: unknown) => parseWithZod(threadIdSchema, value);

export const aiThreadService = {
  parseCreateThreadBody,
  parseCreateTurnBody,
  parseShareBody,
  parseForwardBody,
  parseThreadId,

  async createOrReuseThread(input: {
    requesterId: string;
    chatId: string;
    targetMessageId?: string | null;
  }) {
    await chatService.assertParticipant(input.requesterId, input.chatId);
    if (input.targetMessageId) {
      const target = await prismaAny.message.findUnique({
        where: { id: input.targetMessageId },
        select: { id: true, chatId: true },
      });
      if (!target || target.chatId !== input.chatId) {
        throw new AppError(404, "Target message not found in chat");
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
    if (existing) return { threadId: existing.id, thread: existing };

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

  async getThread(input: { requesterId: string; threadId: string }) {
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

  async createTurnAndEnqueue(input: {
    requesterId: string;
    threadId: string;
    prompt: string;
    commandHint?: "SUMMARIZE" | "EXPLAIN" | "TRANSLATE" | "GENERAL";
    translateTo?: string;
  }) {
    const thread = await assertThreadOwner(input.requesterId, input.threadId);
    const subscriptionActive = await creditsService.hasActiveSubscription(input.requesterId);
    await enforceAiThreadRateLimit({
      requesterId: input.requesterId,
      subscriptionActive,
    });

    const parsed = parseAiCommand({
      prompt: input.prompt,
      commandHint: input.commandHint,
      translateTo: input.translateTo,
    });

    const output = await prismaAny.$transaction(async (tx: any) => {
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
          } as Prisma.InputJsonValue,
        },
      });

      const jobInput: AiJobInput = {
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
          input: jobInput as Prisma.InputJsonValue,
        },
      });

      const updatedAi = await tx.aiTurn.update({
        where: { id: aiPlaceholder.id },
        data: {
          meta: {
            status: "QUEUED",
            jobId: job.id,
          } as Prisma.InputJsonValue,
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

    aiThreadQueue.enqueue(output.job.id);

    return {
      thread,
      userTurn: toTurnPayload(output.userTurn),
      aiTurnPlaceholder: toTurnPayload(output.aiTurnPlaceholder),
      jobId: output.job.id,
    };
  },

  async shareAiTurnToThreadChat(input: {
    requesterId: string;
    threadId: string;
    aiTurnId: string;
  }) {
    const thread = await assertThreadOwner(input.requesterId, input.threadId);
    const turn = await prismaAny.aiTurn.findUnique({
      where: { id: input.aiTurnId },
    });
    if (!turn || turn.threadId !== thread.id || turn.role !== "AI") {
      throw new AppError(404, "AI turn not found");
    }
    const message = await messageService.createMessage({
      userId: input.requesterId,
      chatId: thread.chatId,
      content: turn.content,
      type: "TEXT",
      meta: {
        sharedFromAiThreadId: thread.id,
        sharedFromAiTurnId: turn.id,
        targetMessageId: thread.targetMessageId ?? null,
      } as Prisma.InputJsonValue,
    });
    return { thread, turn, message };
  },

  async forwardAiTurnToChat(input: {
    requesterId: string;
    threadId: string;
    aiTurnId: string;
    toChatId: string;
  }) {
    const thread = await assertThreadOwner(input.requesterId, input.threadId);
    await chatService.assertParticipant(input.requesterId, input.toChatId);
    const turn = await prismaAny.aiTurn.findUnique({
      where: { id: input.aiTurnId },
    });
    if (!turn || turn.threadId !== thread.id || turn.role !== "AI") {
      throw new AppError(404, "AI turn not found");
    }
    const message = await messageService.createMessage({
      userId: input.requesterId,
      chatId: input.toChatId,
      content: turn.content,
      type: "TEXT",
      meta: {
        sharedFromAiThreadId: thread.id,
        sharedFromAiTurnId: turn.id,
        targetMessageId: thread.targetMessageId ?? null,
        forwardedFromAiPanel: true,
      } as Prisma.InputJsonValue,
    });
    return { thread, turn, message };
  },
};
