import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { getChatDek } from "../../security/chatEncryption.service";
import { aiService, type AiChatInputMessage } from "../ai/ai.service";
import { chatService } from "../chat/chat.service";
import { groupService } from "../group/group.service";
import { jobsService } from "../jobs/jobs.service";
import { embedText, storeEmbedding } from "./ai-memory.embeddings";
import {
  AccessibleMessage,
  ContextSourceCandidate,
  ContextMode,
  DEFAULT_CONTEXT_TOKEN_BUDGET,
  MAX_SEARCH_CANDIDATES,
  ResponseSourceType,
  assembleRankedContext,
  buildHashEmbedding,
  buildModeInstruction,
  chunkText,
  clampText,
  combineScores,
  cosineSimilarity,
  createFingerprint,
  estimateTokens,
  filenameFromUrl,
  getMessagePlainText,
  keywordScore,
  normalizeText,
  recencyScore,
  scoreTextRelevance,
  simpleTags,
  slugTopic,
  synthesizeKnowledgeItems,
} from "./ai-memory.helpers";
import {
  contextRespondSchema,
  groupInsightQuerySchema,
  knowledgeExtractSchema,
  knowledgeListSchema,
  knowledgePatchSchema,
  memoryForgetSchema,
  memoryPinSchema,
  memorySearchSchema,
  parseWithZod,
  semanticSearchSchema,
} from "./ai-memory.schemas";

const prismaAny = prisma as any;

const parseKnowledgeExtractBody = (body: unknown) => parseWithZod(knowledgeExtractSchema, body);
const parseKnowledgeListQuery = (query: unknown) => parseWithZod(knowledgeListSchema, query);
const parseKnowledgePatchBody = (body: unknown) => parseWithZod(knowledgePatchSchema, body);
const parseMemoryPinBody = (body: unknown) => parseWithZod(memoryPinSchema, body);
const parseMemoryForgetBody = (body: unknown) => parseWithZod(memoryForgetSchema, body);
const parseMemorySearchQuery = (query: unknown) => parseWithZod(memorySearchSchema, query);
const parseGroupInsightQuery = (query: unknown) => parseWithZod(groupInsightQuerySchema, query);
const parseContextRespondBody = (body: unknown) => parseWithZod(contextRespondSchema, body);
const parseSemanticSearchQuery = (query: unknown) => parseWithZod(semanticSearchSchema, query);

const assertAiMemoryEnabled = () => {
  if (!env.FEATURE_AI_MEMORY) {
    throw new AppError(404, "AI memory is disabled");
  }
};

const assertSemanticSearchEnabled = () => {
  if (!env.FEATURE_SEMANTIC_SEARCH) {
    throw new AppError(404, "Semantic search is disabled");
  }
};

const ensureMemoryPreference = async (userId: string) =>
  prismaAny.memoryPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      autoMemoryEnabled: true,
      allowGroupMemory: true,
      allowFileMemory: true,
      excludedChatIds: [],
      excludedGroupIds: [],
      suppressedTopics: [],
    },
  });

const getAccessibleScopes = async (userId: string) => {
  const [chatParticipants, groupMembers] = await Promise.all([
    prisma.chatParticipant.findMany({
      where: { userId },
      select: { chatId: true },
    }),
    prisma.groupMember.findMany({
      where: { userId, leftAt: null },
      select: { groupId: true },
    }),
  ]);
  return {
    chatIds: chatParticipants.map((item) => item.chatId),
    groupIds: groupMembers.map((item) => item.groupId),
  };
};

const assertKnowledgeAccess = async (userId: string, item: any) => {
  if (item.visibilityScope === "PRIVATE") {
    if (item.createdByUserId !== userId && item.authorUserId !== userId) {
      throw new AppError(403, "Forbidden");
    }
    return;
  }
  if (item.sourceGroupId) {
    await groupService.requireGroupRole(item.sourceGroupId, userId);
    return;
  }
  if (item.sourceConversationId) {
    await chatService.assertParticipant(userId, item.sourceConversationId);
    return;
  }
  throw new AppError(403, "Forbidden");
};

const assertMessageAccess = async (userId: string, messageId: string) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      chatId: true,
      groupId: true,
      senderId: true,
      createdAt: true,
      type: true,
      content: true,
      text: true,
      cipherText: true,
      iv: true,
      authTag: true,
      mediaUrl: true,
      meta: true,
      deletedForEveryone: true,
    },
  });
  if (!message) throw new AppError(404, "Message not found");
  if (message.groupId) {
    await groupService.requireGroupRole(message.groupId, userId);
  } else {
    await chatService.assertParticipant(userId, message.chatId);
  }
  const chatDek = await getChatDek(message.chatId);
  return {
    id: message.id,
    chatId: message.chatId,
    groupId: message.groupId,
    senderId: message.senderId,
    createdAt: message.createdAt,
    type: message.type,
    content: getMessagePlainText(message, chatDek?.dek ?? null),
    mediaUrl: message.mediaUrl,
    meta: (message.meta as Record<string, unknown> | null) ?? null,
  } satisfies AccessibleMessage;
};

const loadMessagesForExtraction = async (
  userId: string,
  input: { chatId?: string; groupId?: string; messageIds?: string[] }
) => {
  if (input.messageIds && input.messageIds.length > 0) {
    const items = await Promise.all(
      input.messageIds.map((messageId) => assertMessageAccess(userId, messageId))
    );
    return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  if (input.groupId) {
    await groupService.requireGroupRole(input.groupId, userId);
    const group = await prisma.group.findUnique({
      where: { id: input.groupId },
      select: { chatId: true },
    });
    if (!group) throw new AppError(404, "Group not found");
    input.chatId = group.chatId;
  }

  if (!input.chatId) {
    throw new AppError(400, "chatId or messageIds is required");
  }

  await chatService.assertParticipant(userId, input.chatId);
  const rows = await prisma.message.findMany({
    where: {
      chatId: input.chatId,
      deletedForEveryone: false,
      kind: "USER",
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      chatId: true,
      groupId: true,
      senderId: true,
      createdAt: true,
      type: true,
      content: true,
      text: true,
      cipherText: true,
      iv: true,
      authTag: true,
      mediaUrl: true,
      meta: true,
      deletedForEveryone: true,
    },
  });
  const chatDek = await getChatDek(input.chatId);
  return rows
    .map((row) => ({
      id: row.id,
      chatId: row.chatId,
      groupId: row.groupId,
      senderId: row.senderId,
      createdAt: row.createdAt,
      type: row.type,
      content: getMessagePlainText(row, chatDek?.dek ?? null),
      mediaUrl: row.mediaUrl,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
    }))
    .filter((item) => item.content || item.mediaUrl)
    .reverse();
};

const enqueueEmbeddingJobsForKnowledge = async (knowledgeItemId: string) => {
  await jobsService.enqueueJob({
    jobId: `embed-knowledge-${knowledgeItemId}`,
    type: "embedding_generate",
    payload: { ownerType: "KNOWLEDGE", ownerId: knowledgeItemId },
  });
};

const enqueueEmbeddingJobsForMemory = async (memoryId: string) => {
  await jobsService.enqueueJob({
    jobId: `embed-memory-${memoryId}`,
    type: "embedding_generate",
    payload: { ownerType: "MEMORY", ownerId: memoryId },
  });
};

const enqueueGroupSummaryJob = async (groupId: string) => {
  await jobsService.enqueueJob({
    jobId: `group-summary-${groupId}`,
    type: "group_weekly_summary",
    payload: { groupId },
  });
};

const createKnowledgeAndMemory = async (input: {
  userId: string;
  messages: AccessibleMessage[];
  requestedType?: any;
  title?: string;
  summary?: string;
  saveToMemory?: boolean;
}) => {
  assertAiMemoryEnabled();
  if (input.messages.length === 0) {
    throw new AppError(400, "No source messages available");
  }
  const preference = await ensureMemoryPreference(input.userId);
  const first = input.messages[0];
  if (first.groupId && preference.excludedGroupIds.includes(first.groupId)) {
    throw new AppError(403, "This group is excluded from AI memory");
  }
  if (preference.excludedChatIds.includes(first.chatId)) {
    throw new AppError(403, "This conversation is excluded from AI memory");
  }

  const candidateItems = synthesizeKnowledgeItems({
    messages: input.messages,
    requestedType: input.requestedType,
    title: input.title,
    summary: input.summary,
  });

  const knowledgeItems: any[] = [];
  const memoryItems: any[] = [];
  for (const candidate of candidateItems) {
    const fingerprint = createFingerprint(
      candidate.type,
      first.chatId,
      first.groupId ?? "",
      candidate.normalizedContent
    );
    const knowledgeItem = await prismaAny.knowledgeItem.upsert({
      where: { fingerprint },
      create: {
        type: candidate.type,
        title: candidate.title,
        shortSummary: candidate.shortSummary,
        normalizedContent: candidate.normalizedContent,
        fingerprint,
        sourceConversationId: first.chatId,
        sourceGroupId: first.groupId,
        authorUserId: first.senderId,
        createdByUserId: input.userId,
        confidenceScore: candidate.confidenceScore,
        visibilityScope: first.groupId ? "GROUP" : "CHAT",
        reviewState: input.requestedType ? "CONFIRMED" : "PENDING",
        tags: candidate.tags,
        sourceWindowStartedAt: input.messages[0]?.createdAt,
        sourceWindowEndedAt: input.messages[input.messages.length - 1]?.createdAt,
      },
      update: {
        title: candidate.title,
        shortSummary: candidate.shortSummary,
        normalizedContent: candidate.normalizedContent,
        confidenceScore: candidate.confidenceScore,
        tags: candidate.tags,
        updatedAt: new Date(),
      },
    });
    await prismaAny.knowledgeSourceLink.deleteMany({
      where: { knowledgeItemId: knowledgeItem.id },
    });
    await prismaAny.knowledgeSourceLink.createMany({
      data: input.messages.map((message) => ({
        knowledgeItemId: knowledgeItem.id,
        messageId: message.id,
        chatId: message.chatId,
        groupId: message.groupId,
        excerpt: clampText(message.content ?? message.mediaUrl ?? "", 240),
      })),
      skipDuplicates: true,
    });
    knowledgeItems.push(knowledgeItem);
    await enqueueEmbeddingJobsForKnowledge(knowledgeItem.id);

    if (input.saveToMemory !== false && preference.autoMemoryEnabled) {
      const memory = await prismaAny.userMemory.create({
        data: {
          userId: input.userId,
          title: candidate.title,
          shortSummary: candidate.shortSummary,
          normalizedContent: candidate.normalizedContent,
          privacyScope: first.groupId ? "SHARED_GROUP" : "PRIVATE",
          tags: candidate.tags,
          topicKey: slugTopic(candidate.title),
          sourceConversationId: first.chatId,
          sourceGroupId: first.groupId,
        },
      });
      await prismaAny.userMemorySourceLink.createMany({
        data: input.messages.map((message) => ({
          userMemoryId: memory.id,
          messageId: message.id,
          chatId: message.chatId,
          groupId: message.groupId,
          excerpt: clampText(message.content ?? message.mediaUrl ?? "", 240),
        })),
        skipDuplicates: true,
      });
      memoryItems.push(memory);
      await enqueueEmbeddingJobsForMemory(memory.id);
    }
  }

  if (first.groupId) {
    await enqueueGroupSummaryJob(first.groupId);
  }

  return { knowledgeItems, memoryItems };
};

const listKnowledge = async (userId: string, input: any) => {
  assertAiMemoryEnabled();
  const scopes = await getAccessibleScopes(userId);
  if (input.chatId) await chatService.assertParticipant(userId, input.chatId);
  if (input.groupId) await groupService.requireGroupRole(input.groupId, userId);

  return prismaAny.knowledgeItem.findMany({
    where: {
      ...(input.chatId ? { sourceConversationId: input.chatId } : {}),
      ...(input.groupId ? { sourceGroupId: input.groupId } : {}),
      ...(input.reviewState ? { reviewState: input.reviewState } : {}),
      ...(input.type ? { type: input.type } : {}),
      OR: [
        {
          visibilityScope: "PRIVATE",
          createdByUserId: userId,
        },
        {
          visibilityScope: "CHAT",
          sourceConversationId: { in: scopes.chatIds.length ? scopes.chatIds : ["__none__"] },
        },
        {
          visibilityScope: "GROUP",
          sourceGroupId: { in: scopes.groupIds.length ? scopes.groupIds : ["__none__"] },
        },
      ],
    },
    include: { sourceLinks: true },
    orderBy: { updatedAt: "desc" },
    take: input.limit ?? 50,
  });
};

const patchKnowledge = async (userId: string, knowledgeId: string, input: any) => {
  assertAiMemoryEnabled();
  const item = await prismaAny.knowledgeItem.findUnique({
    where: { id: knowledgeId },
  });
  if (!item) throw new AppError(404, "Knowledge item not found");
  await assertKnowledgeAccess(userId, item);
  return prismaAny.knowledgeItem.update({
    where: { id: knowledgeId },
    data: {
      ...(input.reviewState ? { reviewState: input.reviewState } : {}),
      ...(input.tags
        ? { tags: Array.from(new Set(input.tags.map((tag: string) => normalizeText(tag)))) }
        : {}),
    },
  });
};

const pinMemory = async (userId: string, memoryId: string) => {
  assertAiMemoryEnabled();
  const memory = await prismaAny.userMemory.findUnique({
    where: { id: memoryId },
  });
  if (!memory || memory.userId !== userId) throw new AppError(404, "Memory not found");
  return prismaAny.userMemory.update({
    where: { id: memoryId },
    data: {
      pinnedAt: memory.pinnedAt ? null : new Date(),
    },
  });
};

const forgetMemory = async (userId: string, input: any) => {
  assertAiMemoryEnabled();
  if (input.memoryId) {
    const memory = await prismaAny.userMemory.findUnique({
      where: { id: input.memoryId },
    });
    if (!memory || memory.userId !== userId) throw new AppError(404, "Memory not found");
    const updated = await prismaAny.userMemory.update({
      where: { id: input.memoryId },
      data: {
        forgottenAt: new Date(),
        pinnedAt: null,
      },
    });
    return { updatedCount: 1, items: [updated] };
  }

  const topicKey = slugTopic(input.topic ?? "");
  const result = await prismaAny.userMemory.updateMany({
    where: {
      userId,
      forgottenAt: null,
      OR: [
        { topicKey },
        { title: { contains: input.topic, mode: "insensitive" } },
        { normalizedContent: { contains: input.topic, mode: "insensitive" } },
      ],
    },
    data: {
      forgottenAt: new Date(),
      pinnedAt: null,
    },
  });
  return { updatedCount: result.count, items: [] };
};

const ensureMemoryEmbeddings = async (userId: string) => {
  assertAiMemoryEnabled();
  const items = await prismaAny.userMemory.findMany({
    where: { userId, forgottenAt: null },
    take: 100,
    orderBy: { updatedAt: "desc" },
  });
  for (const item of items) {
    const existing = await prismaAny.embeddingRecord.findFirst({
      where: { ownerType: "MEMORY", ownerId: item.id, chunkIndex: 0 },
    });
    if (!existing) {
      await storeEmbedding({
        ownerType: "MEMORY",
        ownerId: item.id,
        textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
      });
    }
  }
};

const searchMemory = async (userId: string, input: any) => {
  assertAiMemoryEnabled();
  await ensureMemoryEmbeddings(userId);
  const items = await prismaAny.userMemory.findMany({
    where: {
      userId,
      forgottenAt: null,
      ...(input.pinned ? { pinnedAt: { not: null } } : {}),
      ...(input.topic ? { topicKey: slugTopic(input.topic) } : {}),
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from ? { gte: new Date(input.from) } : {}),
              ...(input.to ? { lte: new Date(input.to) } : {}),
            },
          }
        : {}),
    },
    include: { sourceLinks: true },
    orderBy: input.recent ? { createdAt: "desc" } : { updatedAt: "desc" },
    take: Math.max((input.limit ?? 20) * 3, 20),
  });

  if (!input.q?.trim()) {
    return items.slice(0, input.limit ?? 20);
  }

  const queryEmbedding = await embedText(input.q);
  const embeddings = await prismaAny.embeddingRecord.findMany({
    where: { ownerType: "MEMORY", ownerId: { in: items.map((item: any) => item.id) } },
  });
  const embeddingByOwnerId = new Map<string, any>(
    embeddings.map((item: any) => [item.ownerId, item])
  );

  return items
    .map((item: any) => {
      const embedding = embeddingByOwnerId.get(item.id);
      const vectorScore = Array.isArray(embedding?.vector)
        ? cosineSimilarity(queryEmbedding, embedding.vector as number[])
        : 0;
      const textScore = keywordScore(
        input.q ?? "",
        `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`
      );
      return {
        ...item,
        relevanceScore: Number((vectorScore * 0.7 + textScore * 0.3).toFixed(4)),
      };
    })
    .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
    .slice(0, input.limit ?? 20);
};

const buildOrRefreshGroupSummary = async (groupId: string) => {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, chatId: true },
  });
  if (!group) throw new AppError(404, "Group not found");

  const rows = await prisma.message.findMany({
    where: {
      groupId,
      deletedForEveryone: false,
      kind: "USER",
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      chatId: true,
      groupId: true,
      senderId: true,
      createdAt: true,
      type: true,
      content: true,
      text: true,
      cipherText: true,
      iv: true,
      authTag: true,
      mediaUrl: true,
      meta: true,
      deletedForEveryone: true,
    },
  });
  const chatDek = await getChatDek(group.chatId);
  const messages = rows
    .map((row) => ({
      id: row.id,
      chatId: row.chatId,
      groupId: row.groupId,
      senderId: row.senderId,
      createdAt: row.createdAt,
      type: row.type,
      content: getMessagePlainText(row, chatDek?.dek ?? null),
      mediaUrl: row.mediaUrl,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
    }))
    .filter((item) => item.content || item.mediaUrl)
    .reverse();

  if (!messages.length) return null;
  const combined = normalizeText(messages.map((item) => item.content ?? "").join("\n"));
  const summaryTitle = `Weekly summary ${new Date().toISOString().slice(0, 10)}`;
  const summaryText = clampText(combined, 320);
  const fingerprint = createFingerprint("group-summary", groupId, summaryText);

  const insight = await prismaAny.groupInsight.upsert({
    where: { fingerprint },
    create: {
      groupId,
      type: "WEEKLY_SUMMARY",
      title: summaryTitle,
      shortSummary: summaryText,
      normalizedContent: combined,
      fingerprint,
      status: "ACTIVE",
      sourceWindowStartedAt: messages[0]?.createdAt,
      sourceWindowEndedAt: messages[messages.length - 1]?.createdAt,
    },
    update: {
      title: summaryTitle,
      shortSummary: summaryText,
      normalizedContent: combined,
      updatedAt: new Date(),
    },
  });
  await storeEmbedding({
    ownerType: "GROUP_INSIGHT",
    ownerId: insight.id,
    textContent: `${insight.title}\n${insight.shortSummary}\n${insight.normalizedContent}`,
  });
  return insight;
};

const getGroupInsights = async (userId: string, groupId: string, limit: number) => {
  assertAiMemoryEnabled();
  await groupService.requireGroupRole(groupId, userId);
  await buildOrRefreshGroupSummary(groupId);
  return prismaAny.groupInsight.findMany({
    where: { groupId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
};

const getGroupDecisions = async (userId: string, groupId: string, limit: number) => {
  assertAiMemoryEnabled();
  await groupService.requireGroupRole(groupId, userId);
  return prismaAny.knowledgeItem.findMany({
    where: {
      sourceGroupId: groupId,
      type: "DECISION",
      reviewState: { not: "DISMISSED" },
    },
    include: { sourceLinks: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
};

const getGroupTasks = async (userId: string, groupId: string, limit: number) => {
  assertAiMemoryEnabled();
  await groupService.requireGroupRole(groupId, userId);
  return prismaAny.knowledgeItem.findMany({
    where: {
      sourceGroupId: groupId,
      type: "TASK",
      reviewState: { not: "DISMISSED" },
    },
    include: { sourceLinks: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
};

const assembleContext = async (input: {
  userId: string;
  chatId?: string;
  groupId?: string;
  selectedMessageId?: string;
  query: string;
  pinnedMemoryIds?: string[];
  mode: ContextMode;
  tokenBudget: number;
}) => {
  const sources: ContextSourceCandidate[] = [];
  const queryEmbedding = await embedText(input.query);

  let selectedMessage: AccessibleMessage | null = null;
  let chatId = input.chatId;
  let groupId = input.groupId;

  if (input.selectedMessageId) {
    selectedMessage = await assertMessageAccess(input.userId, input.selectedMessageId);
    chatId = chatId ?? selectedMessage.chatId;
    groupId = groupId ?? selectedMessage.groupId ?? undefined;
    sources.push({
      sourceType: "MESSAGE",
      sourceId: selectedMessage.id,
      title: "Selected message",
      snippet: clampText(selectedMessage.content ?? selectedMessage.mediaUrl ?? "", 200),
      relevanceScore: 1,
      section: "selected_message",
      meta: {
        chatId: selectedMessage.chatId,
        groupId: selectedMessage.groupId,
        scoreBreakdown: { selected: 1 },
        rankingReason: "user_selected_message",
      },
    });
  }

  if (groupId) {
    await groupService.requireGroupRole(groupId, input.userId);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { chatId: true },
    });
    if (!group) throw new AppError(404, "Group not found");
    chatId = group.chatId;
  }
  if (chatId) {
    await chatService.assertParticipant(input.userId, chatId);
  }

  const recentMessages = chatId ? await loadMessagesForExtraction(input.userId, { chatId }) : [];
  recentMessages
    .filter((message) => message.id !== selectedMessage?.id)
    .slice(-12)
    .map((message, index, arr) => {
      const content = message.content ?? message.mediaUrl ?? "";
      const semanticScore = cosineSimilarity(queryEmbedding, buildHashEmbedding(content));
      const recency = recencyScore(message.createdAt, { horizonDays: 14 });
      const score = scoreTextRelevance(input.query, content, semanticScore, recency);
      return {
        sourceType: "MESSAGE" as const,
        sourceId: message.id,
        title: `Recent message ${index + 1}/${arr.length}`,
        snippet: clampText(content, 220),
        relevanceScore: score,
        section: "recent_conversation" as const,
        meta: {
          chatId: message.chatId,
          groupId: message.groupId,
          createdAt: message.createdAt.toISOString(),
          scoreBreakdown: {
            keyword: keywordScore(input.query, content),
            semantic: semanticScore,
            recency,
          },
          rankingReason: "recent_conversation_match",
        },
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8)
    .forEach((candidate) => {
      sources.push(candidate);
    });

  const memories = await searchMemory(input.userId, { q: input.query, limit: 5 });
  memories.forEach((memory: any, index: number) => {
    sources.push({
      sourceType: "MEMORY",
      sourceId: memory.id,
      title: memory.title,
      snippet: clampText(memory.shortSummary ?? memory.normalizedContent, 180),
      relevanceScore: memory.relevanceScore ?? 0.7 - index * 0.05,
      section: "relevant_memory",
      meta: {
        chatId: memory.sourceConversationId,
        groupId: memory.sourceGroupId,
        pinned: Boolean(memory.pinnedAt),
        scoreBreakdown: {
          relevance: memory.relevanceScore ?? 0.7 - index * 0.05,
        },
        rankingReason: "memory_retrieval_match",
      },
    });
  });

  if (Array.isArray(input.pinnedMemoryIds) && input.pinnedMemoryIds.length > 0) {
    const pinned = await prismaAny.userMemory.findMany({
      where: {
        userId: input.userId,
        id: { in: input.pinnedMemoryIds },
        forgottenAt: null,
      },
      take: 20,
    });
    pinned.forEach((memory: any) => {
      sources.push({
        sourceType: "MEMORY",
        sourceId: memory.id,
        title: `${memory.title} (Pinned)`,
        snippet: clampText(memory.shortSummary ?? memory.normalizedContent, 180),
        relevanceScore: 0.95,
        section: "relevant_memory",
        meta: {
          chatId: memory.sourceConversationId,
          groupId: memory.sourceGroupId,
          pinned: true,
          scoreBreakdown: { pinnedBoost: 0.95 },
          rankingReason: "pinned_memory",
        },
      });
    });
  }

  if (groupId) {
    const [insights, decisions, tasks] = await Promise.all([
      getGroupInsights(input.userId, groupId, 3),
      getGroupDecisions(input.userId, groupId, 3),
      getGroupTasks(input.userId, groupId, 3),
    ]);
    [...insights, ...decisions, ...tasks]
      .map((insight: any, index: number) => {
        const insightText = `${insight.title}\n${insight.shortSummary}\n${insight.normalizedContent ?? ""}`;
        const semanticScore = Array.isArray(insight.embeddingVector)
          ? cosineSimilarity(queryEmbedding, insight.embeddingVector as number[])
          : 0;
        const recency = recencyScore(new Date(insight.updatedAt), { horizonDays: 45 });
        const score = combineScores([
          [keywordScore(input.query, insightText), 0.45],
          [semanticScore, 0.35],
          [recency, 0.2],
        ]);
        return {
          sourceType: "GROUP_INSIGHT" as const,
          sourceId: insight.id,
          title: insight.title,
          snippet: clampText(insight.shortSummary, 180),
          relevanceScore: score + Math.max(0, 0.03 - index * 0.005),
          section: "group_insights" as const,
          meta: {
            groupId,
            insightType: insight.type ?? "GROUP_KNOWLEDGE",
            scoreBreakdown: {
              keyword: keywordScore(input.query, insightText),
              semantic: semanticScore,
              recency,
            },
            rankingReason: "group_intelligence_match",
          },
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 6)
      .forEach((candidate) => {
        sources.push(candidate);
      });
  }

  const fileScopeWhere = chatId
    ? { chatId }
    : groupId
    ? { groupId }
    : undefined;

  const files = fileScopeWhere
    ? await prismaAny.messageMedia.findMany({
        where: {
          message: {
            deletedForEveryone: false,
            ...fileScopeWhere,
          },
        },
        include: {
          message: {
            select: {
              id: true,
              chatId: true,
              groupId: true,
              createdAt: true,
              content: true,
              text: true,
              meta: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];

  for (const file of files) {
    const filename = filenameFromUrl(file.url);
    const messageMeta =
      file.message?.meta && typeof file.message.meta === "object"
        ? (file.message.meta as Record<string, unknown>)
        : null;
    const extractedTextCandidates = [
      typeof messageMeta?.extractedText === "string" ? messageMeta.extractedText : "",
      typeof messageMeta?.fileText === "string" ? messageMeta.fileText : "",
      typeof messageMeta?.ocrText === "string" ? messageMeta.ocrText : "",
      typeof messageMeta?.transcript === "string" ? messageMeta.transcript : "",
      file.message?.content ?? "",
      file.message?.text ?? "",
      `${file.kind} ${filename}`,
    ]
      .filter(Boolean)
      .join("\n");

    let chunkRecords = await prismaAny.embeddingRecord.findMany({
      where: { ownerType: "FILE", ownerId: file.id },
      orderBy: { chunkIndex: "asc" },
    });

    if (chunkRecords.length === 0) {
      const chunks = chunkText(extractedTextCandidates, 700, 120);
      if (chunks.length > 0) {
        const createdChunks = [];
        for (let index = 0; index < chunks.length; index += 1) {
          const stored = await storeEmbedding({
            ownerType: "FILE",
            ownerId: file.id,
            chunkIndex: index,
            textContent: chunks[index],
            meta: {
              chatId: file.message.chatId,
              groupId: file.message.groupId,
              messageId: file.message.id,
              kind: file.kind,
              filename,
            },
          });
          if (stored) createdChunks.push(stored);
        }
        chunkRecords = createdChunks;
      }
    }

    chunkRecords
      .map((chunk: any) => {
        const semanticScore = Array.isArray(chunk.vector)
          ? cosineSimilarity(queryEmbedding, chunk.vector as number[])
          : 0;
        const recency = recencyScore(new Date(file.message.createdAt), { horizonDays: 30 });
        const score = scoreTextRelevance(input.query, chunk.textContent, semanticScore, recency);
        return {
          sourceType: "FILE" as const,
          sourceId: `${file.id}#${chunk.chunkIndex}`,
          title: `${filename} · chunk ${Number(chunk.chunkIndex) + 1}`,
          snippet: clampText(chunk.textContent, 220),
          relevanceScore: score,
          section: "relevant_files" as const,
          meta: {
            fileId: file.id,
            messageId: file.message.id,
            chatId: file.message.chatId,
            groupId: file.message.groupId,
            kind: file.kind,
            filename,
            chunkIndex: chunk.chunkIndex,
            scoreBreakdown: {
              keyword: keywordScore(input.query, chunk.textContent),
              semantic: semanticScore,
              recency,
            },
            rankingReason: "file_chunk_match",
          },
        };
      })
      .sort(
        (
          a: ContextSourceCandidate,
          b: ContextSourceCandidate
        ) => b.relevanceScore - a.relevanceScore
      )
      .slice(0, 4)
      .forEach((candidate: ContextSourceCandidate) => {
        sources.push({
          ...candidate,
        });
      });
  }

  const deduped = sources.filter(
    (item, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.sourceType === item.sourceType && candidate.sourceId === item.sourceId
      ) === index
  );

  const ranked = deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const assembled = assembleRankedContext({
    mode: input.mode,
    tokenBudget: input.tokenBudget,
    candidates: ranked,
  });
  const rankedWithMetadata = assembled.selectedSources.map((source, index) => ({
    ...source,
    meta: {
      ...source.meta,
      section: source.section,
      rank: index + 1,
      tokenCost: source.tokenCost ?? estimateTokens(source.snippet),
    },
  }));

  return {
    chatId,
    groupId,
    selectedMessage,
    usedTokens: assembled.usedTokens,
    budgets: assembled.budgets,
    usedBySection: assembled.usedBySection,
    sources: rankedWithMetadata,
    promptContext: assembled.promptContext,
  };
};

const localContextFallback = (mode: ContextMode, query: string, promptContext: string) => {
  const intro =
    mode === "SEARCH_MEMORY"
      ? "Memory search results"
      : mode === "PROJECT_UPDATE"
      ? "Project update"
      : "Context-aware answer";
  return `${intro}\n\nQuestion: ${query}\n\nRelevant context:\n${promptContext || "No strong context found."}`;
};

const respondWithContext = async (userId: string, input: any) => {
  assertAiMemoryEnabled();
  const assembled = await assembleContext({
    userId,
    chatId: input.chatId,
    groupId: input.groupId,
    selectedMessageId: input.selectedMessageId,
    query: input.query,
    pinnedMemoryIds: input.pinnedMemoryIds,
    mode: input.mode,
    tokenBudget: input.tokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET,
  });

  let replyText = "";
  let usage = {
    promptTokens: estimateTokens(assembled.promptContext),
    completionTokens: 0,
    totalTokens: estimateTokens(assembled.promptContext),
  };

  try {
    const selection = input.model?.trim() ? aiService.parseModelSelection(input.model) : null;
    const available = aiService.listEnabledModels();
    const provider = selection?.provider ?? available[0];
    const version = selection?.version ?? aiService.listProviderVersions(provider)[0];
    const messages: AiChatInputMessage[] = [
      {
        role: "system",
        content: [
          "You are the platform knowledge engine.",
          buildModeInstruction(input.mode),
          "Use only the supplied context.",
          "When evidence is missing, say so plainly.",
          "Prefer specific, source-grounded statements over generic advice.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Mode: ${input.mode}`,
          "",
          "User query:",
          input.query,
          "",
          "Context:",
          assembled.promptContext || "No strong context found.",
        ].join("\n"),
      },
    ];
    const result = await aiService.createChatCompletion({
      model: provider,
      modelVersion: version,
      messages,
      temperature: 0.2,
      maxTokens: 600,
    });
    replyText = result.text;
    usage = result.usage;
  } catch {
    replyText = localContextFallback(input.mode, input.query, assembled.promptContext);
    usage = {
      promptTokens: estimateTokens(assembled.promptContext),
      completionTokens: estimateTokens(replyText),
      totalTokens: estimateTokens(assembled.promptContext) + estimateTokens(replyText),
    };
  }

  const session = await prismaAny.aIContextSession.create({
    data: {
      userId,
      chatId: assembled.chatId ?? null,
      groupId: assembled.groupId ?? null,
      mode: input.mode,
      query: input.query,
      selectedMessageId: input.selectedMessageId ?? null,
      pinnedMemoryIds: input.pinnedMemoryIds ?? [],
      assembledContext: {
        promptContext: assembled.promptContext,
        usedTokens: assembled.usedTokens,
        budgets: assembled.budgets,
        usedBySection: assembled.usedBySection,
      },
      tokenBudget: input.tokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET,
    },
  });

  if (assembled.sources.length > 0) {
    await prismaAny.aIResponseSource.createMany({
      data: assembled.sources.map((source) => ({
        contextSessionId: session.id,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        title: source.title,
        snippet: source.snippet,
        relevanceScore: source.relevanceScore,
        meta: source.meta,
      })),
    });
  }

  return {
    contextSessionId: session.id,
    reply: { text: replyText, mode: input.mode, usage },
    sourcesUsed: assembled.sources,
  };
};

const ensureKnowledgeAndInsightEmbeddings = async (userId: string) => {
  const scopes = await getAccessibleScopes(userId);
  const [knowledge, insights] = await Promise.all([
    prismaAny.knowledgeItem.findMany({
      where: {
        OR: [
          { createdByUserId: userId },
          { sourceConversationId: { in: scopes.chatIds.length ? scopes.chatIds : ["__none__"] } },
          { sourceGroupId: { in: scopes.groupIds.length ? scopes.groupIds : ["__none__"] } },
        ],
      },
      take: 100,
    }),
    prismaAny.groupInsight.findMany({
      where: { groupId: { in: scopes.groupIds.length ? scopes.groupIds : ["__none__"] } },
      take: 50,
    }),
  ]);

  for (const item of knowledge) {
    const existing = await prismaAny.embeddingRecord.findFirst({
      where: { ownerType: "KNOWLEDGE", ownerId: item.id, chunkIndex: 0 },
    });
    if (!existing) {
      await storeEmbedding({
        ownerType: "KNOWLEDGE",
        ownerId: item.id,
        textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
      });
    }
  }

  for (const item of insights) {
    const existing = await prismaAny.embeddingRecord.findFirst({
      where: { ownerType: "GROUP_INSIGHT", ownerId: item.id, chunkIndex: 0 },
    });
    if (!existing) {
      await storeEmbedding({
        ownerType: "GROUP_INSIGHT",
        ownerId: item.id,
        textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
      });
    }
  }
};

const semanticSearch = async (userId: string, input: any) => {
  assertSemanticSearchEnabled();
  if (input.chatId) await chatService.assertParticipant(userId, input.chatId);
  if (input.groupId) await groupService.requireGroupRole(input.groupId, userId);

  await Promise.all([ensureMemoryEmbeddings(userId), ensureKnowledgeAndInsightEmbeddings(userId)]);
  const scopes = await getAccessibleScopes(userId);
  const queryEmbedding = await embedText(input.q);

  const [memories, knowledge, insights] = await Promise.all([
    prismaAny.userMemory.findMany({
      where: { userId, forgottenAt: null },
      include: { sourceLinks: true },
      take: MAX_SEARCH_CANDIDATES,
      orderBy: { updatedAt: "desc" },
    }),
    prismaAny.knowledgeItem.findMany({
      where: {
        reviewState: { not: "DISMISSED" },
        OR: [
          { createdByUserId: userId },
          { sourceConversationId: { in: scopes.chatIds.length ? scopes.chatIds : ["__none__"] } },
          { sourceGroupId: { in: scopes.groupIds.length ? scopes.groupIds : ["__none__"] } },
        ],
      },
      include: { sourceLinks: true },
      take: MAX_SEARCH_CANDIDATES,
      orderBy: { updatedAt: "desc" },
    }),
    prismaAny.groupInsight.findMany({
      where: { groupId: { in: scopes.groupIds.length ? scopes.groupIds : ["__none__"] } },
      take: MAX_SEARCH_CANDIDATES,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const messageCandidates = input.chatId
    ? await loadMessagesForExtraction(userId, { chatId: input.chatId })
    : [];

  const embeddingRecords = await prismaAny.embeddingRecord.findMany({
    where: {
      OR: [
        { ownerType: "MEMORY", ownerId: { in: memories.map((item: any) => item.id) } },
        { ownerType: "KNOWLEDGE", ownerId: { in: knowledge.map((item: any) => item.id) } },
        { ownerType: "GROUP_INSIGHT", ownerId: { in: insights.map((item: any) => item.id) } },
      ],
    },
  });
  const embeddingKey = (ownerType: string, ownerId: string) => `${ownerType}:${ownerId}`;
  const embeddingByKey = new Map<string, any>(
    embeddingRecords.map((item: any) => [embeddingKey(item.ownerType, item.ownerId), item])
  );

  const results: Array<{
    id: string;
    title: string;
    snippet: string;
    resultType: string;
    sourceLocation: Record<string, unknown>;
    date: string;
    relevanceScore: number;
  }> = [];

  memories.forEach((item: any) => {
    const record = embeddingByKey.get(embeddingKey("MEMORY", item.id));
    const vectorScore = Array.isArray(record?.vector)
      ? cosineSimilarity(queryEmbedding, record.vector as number[])
      : 0;
    const textScore = keywordScore(input.q, `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
    results.push({
      id: item.id,
      title: item.title,
      snippet: clampText(item.shortSummary, 180),
      resultType: "memory",
      sourceLocation: { chatId: item.sourceConversationId, groupId: item.sourceGroupId },
      date: item.updatedAt.toISOString(),
      relevanceScore: vectorScore * 0.7 + textScore * 0.3,
    });
  });

  knowledge.forEach((item: any) => {
    const resultType =
      item.type === "DECISION" ? "decision" : item.type === "TASK" ? "task" : "knowledge";
    const record = embeddingByKey.get(embeddingKey("KNOWLEDGE", item.id));
    const vectorScore = Array.isArray(record?.vector)
      ? cosineSimilarity(queryEmbedding, record.vector as number[])
      : 0;
    const textScore = keywordScore(input.q, `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
    results.push({
      id: item.id,
      title: item.title,
      snippet: clampText(item.shortSummary, 180),
      resultType,
      sourceLocation: {
        chatId: item.sourceConversationId,
        groupId: item.sourceGroupId,
        messageIds: item.sourceLinks.map((link: any) => link.messageId).filter(Boolean),
      },
      date: item.updatedAt.toISOString(),
      relevanceScore: vectorScore * 0.7 + textScore * 0.3,
    });
  });

  insights.forEach((item: any) => {
    const record = embeddingByKey.get(embeddingKey("GROUP_INSIGHT", item.id));
    const vectorScore = Array.isArray(record?.vector)
      ? cosineSimilarity(queryEmbedding, record.vector as number[])
      : 0;
    const textScore = keywordScore(input.q, `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
    results.push({
      id: item.id,
      title: item.title,
      snippet: clampText(item.shortSummary, 180),
      resultType: "knowledge",
      sourceLocation: { groupId: item.groupId },
      date: item.updatedAt.toISOString(),
      relevanceScore: vectorScore * 0.7 + textScore * 0.3,
    });
  });

  messageCandidates.forEach((item) => {
    const content = item.content ?? item.mediaUrl ?? "";
    if (!content) return;
    const textScore = keywordScore(input.q, content);
    const vectorScore = cosineSimilarity(queryEmbedding, buildHashEmbedding(content));
    results.push({
      id: item.id,
      title: clampText(content, 80),
      snippet: clampText(content, 180),
      resultType: item.type === "FILE" ? "file" : "message",
      sourceLocation: { chatId: item.chatId, groupId: item.groupId, messageId: item.id },
      date: item.createdAt.toISOString(),
      relevanceScore: vectorScore * 0.6 + textScore * 0.4,
    });
  });

  const filtered = results
    .filter((item) => (input.type ? item.resultType === input.type : true))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, input.limit ?? 20);

  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    acc[item.resultType] = [...(acc[item.resultType] ?? []), item];
    return acc;
  }, {});

  return {
    query: input.q,
    groups: Object.entries(groups).map(([type, items]) => ({ type, items })),
  };
};

const runEmbeddingJob = async (payload: Record<string, unknown>) => {
  const ownerType = String(payload.ownerType ?? "");
  const ownerId = String(payload.ownerId ?? "");
  if (!ownerType || !ownerId) return;
  if (ownerType === "FILE") {
    const file = await prismaAny.messageMedia.findUnique({
      where: { id: ownerId },
      include: {
        message: {
          select: {
            id: true,
            chatId: true,
            groupId: true,
            content: true,
            text: true,
            meta: true,
          },
        },
      },
    });
    if (!file || !file.message) return;
    const messageMeta =
      file.message.meta && typeof file.message.meta === "object"
        ? (file.message.meta as Record<string, unknown>)
        : null;
    const sourceText = [
      typeof messageMeta?.extractedText === "string" ? messageMeta.extractedText : "",
      typeof messageMeta?.fileText === "string" ? messageMeta.fileText : "",
      typeof messageMeta?.ocrText === "string" ? messageMeta.ocrText : "",
      file.message.content ?? "",
      file.message.text ?? "",
      `${file.kind} ${filenameFromUrl(file.url)}`,
    ]
      .filter(Boolean)
      .join("\n");
    const chunks = chunkText(sourceText, 700, 120);
    for (let index = 0; index < chunks.length; index += 1) {
      await storeEmbedding({
        ownerType: "FILE",
        ownerId,
        chunkIndex: index,
        textContent: chunks[index],
        meta: {
          chatId: file.message.chatId,
          groupId: file.message.groupId,
          messageId: file.message.id,
          filename: filenameFromUrl(file.url),
          kind: file.kind,
        },
      });
    }
    return;
  }
  if (ownerType === "KNOWLEDGE") {
    const item = await prismaAny.knowledgeItem.findUnique({ where: { id: ownerId } });
    if (!item) return;
    await storeEmbedding({
      ownerType: "KNOWLEDGE",
      ownerId,
      textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
    });
    return;
  }
  if (ownerType === "MEMORY") {
    const item = await prismaAny.userMemory.findUnique({ where: { id: ownerId } });
    if (!item || item.forgottenAt) return;
    await storeEmbedding({
      ownerType: "MEMORY",
      ownerId,
      textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
    });
    return;
  }
  if (ownerType === "GROUP_INSIGHT") {
    const item = await prismaAny.groupInsight.findUnique({ where: { id: ownerId } });
    if (!item) return;
    await storeEmbedding({
      ownerType: "GROUP_INSIGHT",
      ownerId,
      textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
    });
  }
};

const runKnowledgeExtractionJob = async (payload: Record<string, unknown>) => {
  const userId = String(payload.userId ?? "");
  if (!userId) return;
  const messageIds = Array.isArray(payload.messageIds)
    ? payload.messageIds.map((item) => String(item)).filter(Boolean)
    : [];
  const chatId = payload.chatId ? String(payload.chatId) : undefined;
  const groupId = payload.groupId ? String(payload.groupId) : undefined;
  const messages = await loadMessagesForExtraction(userId, { chatId, groupId, messageIds });
  if (!messages.length) return;
  await createKnowledgeAndMemory({
    userId,
    messages,
    saveToMemory: payload.saveToMemory !== false,
  });
};

const runGroupSummaryJob = async (payload: Record<string, unknown>) => {
  const groupId = String(payload.groupId ?? "");
  if (!groupId) return;
  await buildOrRefreshGroupSummary(groupId);
};

const enqueueAutoKnowledgeExtraction = async (input: {
  userId: string;
  chatId: string;
  groupId?: string | null;
  messageIds: string[];
}) => {
  if (!(env as any).FEATURE_AI_MEMORY) return;
  await jobsService.enqueueJob({
    jobId: `knowledge-auto-${input.chatId}-${input.messageIds.join("-")}`,
    type: "knowledge_extract",
    userId: input.userId,
    payload: {
      userId: input.userId,
      chatId: input.chatId,
      groupId: input.groupId ?? null,
      messageIds: input.messageIds,
      saveToMemory: true,
    },
  });
};

export const aiMemoryService = {
  parseKnowledgeExtractBody,
  parseKnowledgeListQuery,
  parseKnowledgePatchBody,
  parseMemoryPinBody,
  parseMemoryForgetBody,
  parseMemorySearchQuery,
  parseGroupInsightQuery,
  parseContextRespondBody,
  parseSemanticSearchQuery,
  createKnowledgeAndMemory,
  listKnowledge,
  patchKnowledge,
  pinMemory,
  forgetMemory,
  searchMemory,
  getGroupInsights,
  getGroupDecisions,
  getGroupTasks,
  respondWithContext,
  semanticSearch,
  assembleContext,
  runEmbeddingJob,
  runKnowledgeExtractionJob,
  runGroupSummaryJob,
  enqueueAutoKnowledgeExtraction,
  loadMessagesForExtraction,
};
