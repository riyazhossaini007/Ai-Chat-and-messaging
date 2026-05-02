"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiMemoryService = void 0;
const env_1 = require("../../config/env");
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const chatEncryption_service_1 = require("../../security/chatEncryption.service");
const ai_service_1 = require("../ai/ai.service");
const chat_service_1 = require("../chat/chat.service");
const group_service_1 = require("../group/group.service");
const jobs_service_1 = require("../jobs/jobs.service");
const ai_memory_embeddings_1 = require("./ai-memory.embeddings");
const ai_memory_helpers_1 = require("./ai-memory.helpers");
const ai_memory_schemas_1 = require("./ai-memory.schemas");
const prismaAny = prisma_1.prisma;
const parseKnowledgeExtractBody = (body) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.knowledgeExtractSchema, body);
const parseKnowledgeListQuery = (query) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.knowledgeListSchema, query);
const parseKnowledgePatchBody = (body) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.knowledgePatchSchema, body);
const parseMemoryPinBody = (body) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.memoryPinSchema, body);
const parseMemoryForgetBody = (body) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.memoryForgetSchema, body);
const parseMemorySearchQuery = (query) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.memorySearchSchema, query);
const parseGroupInsightQuery = (query) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.groupInsightQuerySchema, query);
const parseContextRespondBody = (body) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.contextRespondSchema, body);
const parseSemanticSearchQuery = (query) => (0, ai_memory_schemas_1.parseWithZod)(ai_memory_schemas_1.semanticSearchSchema, query);
const assertAiMemoryEnabled = () => {
    if (!env_1.env.FEATURE_AI_MEMORY) {
        throw new errorHandler_1.AppError(404, "AI memory is disabled");
    }
};
const assertSemanticSearchEnabled = () => {
    if (!env_1.env.FEATURE_SEMANTIC_SEARCH) {
        throw new errorHandler_1.AppError(404, "Semantic search is disabled");
    }
};
const ensureMemoryPreference = async (userId) => prismaAny.memoryPreference.upsert({
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
const getAccessibleScopes = async (userId) => {
    const [chatParticipants, groupMembers] = await Promise.all([
        prisma_1.prisma.chatParticipant.findMany({
            where: { userId },
            select: { chatId: true },
        }),
        prisma_1.prisma.groupMember.findMany({
            where: { userId, leftAt: null },
            select: { groupId: true },
        }),
    ]);
    return {
        chatIds: chatParticipants.map((item) => item.chatId),
        groupIds: groupMembers.map((item) => item.groupId),
    };
};
const assertKnowledgeAccess = async (userId, item) => {
    if (item.visibilityScope === "PRIVATE") {
        if (item.createdByUserId !== userId && item.authorUserId !== userId) {
            throw new errorHandler_1.AppError(403, "Forbidden");
        }
        return;
    }
    if (item.sourceGroupId) {
        await group_service_1.groupService.requireGroupRole(item.sourceGroupId, userId);
        return;
    }
    if (item.sourceConversationId) {
        await chat_service_1.chatService.assertParticipant(userId, item.sourceConversationId);
        return;
    }
    throw new errorHandler_1.AppError(403, "Forbidden");
};
const assertMessageAccess = async (userId, messageId) => {
    const message = await prisma_1.prisma.message.findUnique({
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
    if (!message)
        throw new errorHandler_1.AppError(404, "Message not found");
    if (message.groupId) {
        await group_service_1.groupService.requireGroupRole(message.groupId, userId);
    }
    else {
        await chat_service_1.chatService.assertParticipant(userId, message.chatId);
    }
    const chatDek = await (0, chatEncryption_service_1.getChatDek)(message.chatId);
    return {
        id: message.id,
        chatId: message.chatId,
        groupId: message.groupId,
        senderId: message.senderId,
        createdAt: message.createdAt,
        type: message.type,
        content: (0, ai_memory_helpers_1.getMessagePlainText)(message, chatDek?.dek ?? null),
        mediaUrl: message.mediaUrl,
        meta: message.meta ?? null,
    };
};
const loadMessagesForExtraction = async (userId, input) => {
    if (input.messageIds && input.messageIds.length > 0) {
        const items = await Promise.all(input.messageIds.map((messageId) => assertMessageAccess(userId, messageId)));
        return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    if (input.groupId) {
        await group_service_1.groupService.requireGroupRole(input.groupId, userId);
        const group = await prisma_1.prisma.group.findUnique({
            where: { id: input.groupId },
            select: { chatId: true },
        });
        if (!group)
            throw new errorHandler_1.AppError(404, "Group not found");
        input.chatId = group.chatId;
    }
    if (!input.chatId) {
        throw new errorHandler_1.AppError(400, "chatId or messageIds is required");
    }
    await chat_service_1.chatService.assertParticipant(userId, input.chatId);
    const rows = await prisma_1.prisma.message.findMany({
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
    const chatDek = await (0, chatEncryption_service_1.getChatDek)(input.chatId);
    return rows
        .map((row) => ({
        id: row.id,
        chatId: row.chatId,
        groupId: row.groupId,
        senderId: row.senderId,
        createdAt: row.createdAt,
        type: row.type,
        content: (0, ai_memory_helpers_1.getMessagePlainText)(row, chatDek?.dek ?? null),
        mediaUrl: row.mediaUrl,
        meta: row.meta ?? null,
    }))
        .filter((item) => item.content || item.mediaUrl)
        .reverse();
};
const enqueueEmbeddingJobsForKnowledge = async (knowledgeItemId) => {
    await jobs_service_1.jobsService.enqueueJob({
        jobId: `embed-knowledge-${knowledgeItemId}`,
        type: "embedding_generate",
        payload: { ownerType: "KNOWLEDGE", ownerId: knowledgeItemId },
    });
};
const enqueueEmbeddingJobsForMemory = async (memoryId) => {
    await jobs_service_1.jobsService.enqueueJob({
        jobId: `embed-memory-${memoryId}`,
        type: "embedding_generate",
        payload: { ownerType: "MEMORY", ownerId: memoryId },
    });
};
const enqueueGroupSummaryJob = async (groupId) => {
    await jobs_service_1.jobsService.enqueueJob({
        jobId: `group-summary-${groupId}`,
        type: "group_weekly_summary",
        payload: { groupId },
    });
};
const createKnowledgeAndMemory = async (input) => {
    assertAiMemoryEnabled();
    if (input.messages.length === 0) {
        throw new errorHandler_1.AppError(400, "No source messages available");
    }
    const preference = await ensureMemoryPreference(input.userId);
    const first = input.messages[0];
    if (first.groupId && preference.excludedGroupIds.includes(first.groupId)) {
        throw new errorHandler_1.AppError(403, "This group is excluded from AI memory");
    }
    if (preference.excludedChatIds.includes(first.chatId)) {
        throw new errorHandler_1.AppError(403, "This conversation is excluded from AI memory");
    }
    const candidateItems = (0, ai_memory_helpers_1.synthesizeKnowledgeItems)({
        messages: input.messages,
        requestedType: input.requestedType,
        title: input.title,
        summary: input.summary,
    });
    const knowledgeItems = [];
    const memoryItems = [];
    for (const candidate of candidateItems) {
        const fingerprint = (0, ai_memory_helpers_1.createFingerprint)(candidate.type, first.chatId, first.groupId ?? "", candidate.normalizedContent);
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
                excerpt: (0, ai_memory_helpers_1.clampText)(message.content ?? message.mediaUrl ?? "", 240),
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
                    topicKey: (0, ai_memory_helpers_1.slugTopic)(candidate.title),
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
                    excerpt: (0, ai_memory_helpers_1.clampText)(message.content ?? message.mediaUrl ?? "", 240),
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
const listKnowledge = async (userId, input) => {
    assertAiMemoryEnabled();
    const scopes = await getAccessibleScopes(userId);
    if (input.chatId)
        await chat_service_1.chatService.assertParticipant(userId, input.chatId);
    if (input.groupId)
        await group_service_1.groupService.requireGroupRole(input.groupId, userId);
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
const patchKnowledge = async (userId, knowledgeId, input) => {
    assertAiMemoryEnabled();
    const item = await prismaAny.knowledgeItem.findUnique({
        where: { id: knowledgeId },
    });
    if (!item)
        throw new errorHandler_1.AppError(404, "Knowledge item not found");
    await assertKnowledgeAccess(userId, item);
    return prismaAny.knowledgeItem.update({
        where: { id: knowledgeId },
        data: {
            ...(input.reviewState ? { reviewState: input.reviewState } : {}),
            ...(input.tags
                ? { tags: Array.from(new Set(input.tags.map((tag) => (0, ai_memory_helpers_1.normalizeText)(tag)))) }
                : {}),
        },
    });
};
const pinMemory = async (userId, memoryId) => {
    assertAiMemoryEnabled();
    const memory = await prismaAny.userMemory.findUnique({
        where: { id: memoryId },
    });
    if (!memory || memory.userId !== userId)
        throw new errorHandler_1.AppError(404, "Memory not found");
    return prismaAny.userMemory.update({
        where: { id: memoryId },
        data: {
            pinnedAt: memory.pinnedAt ? null : new Date(),
        },
    });
};
const forgetMemory = async (userId, input) => {
    assertAiMemoryEnabled();
    if (input.memoryId) {
        const memory = await prismaAny.userMemory.findUnique({
            where: { id: input.memoryId },
        });
        if (!memory || memory.userId !== userId)
            throw new errorHandler_1.AppError(404, "Memory not found");
        const updated = await prismaAny.userMemory.update({
            where: { id: input.memoryId },
            data: {
                forgottenAt: new Date(),
                pinnedAt: null,
            },
        });
        return { updatedCount: 1, items: [updated] };
    }
    const topicKey = (0, ai_memory_helpers_1.slugTopic)(input.topic ?? "");
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
const ensureMemoryEmbeddings = async (userId) => {
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
            await (0, ai_memory_embeddings_1.storeEmbedding)({
                ownerType: "MEMORY",
                ownerId: item.id,
                textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
            });
        }
    }
};
const searchMemory = async (userId, input) => {
    assertAiMemoryEnabled();
    await ensureMemoryEmbeddings(userId);
    const items = await prismaAny.userMemory.findMany({
        where: {
            userId,
            forgottenAt: null,
            ...(input.pinned ? { pinnedAt: { not: null } } : {}),
            ...(input.topic ? { topicKey: (0, ai_memory_helpers_1.slugTopic)(input.topic) } : {}),
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
    const queryEmbedding = await (0, ai_memory_embeddings_1.embedText)(input.q);
    const embeddings = await prismaAny.embeddingRecord.findMany({
        where: { ownerType: "MEMORY", ownerId: { in: items.map((item) => item.id) } },
    });
    const embeddingByOwnerId = new Map(embeddings.map((item) => [item.ownerId, item]));
    return items
        .map((item) => {
        const embedding = embeddingByOwnerId.get(item.id);
        const vectorScore = Array.isArray(embedding?.vector)
            ? (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, embedding.vector)
            : 0;
        const textScore = (0, ai_memory_helpers_1.keywordScore)(input.q ?? "", `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
        return {
            ...item,
            relevanceScore: Number((vectorScore * 0.7 + textScore * 0.3).toFixed(4)),
        };
    })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, input.limit ?? 20);
};
const buildOrRefreshGroupSummary = async (groupId) => {
    const group = await prisma_1.prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true, chatId: true },
    });
    if (!group)
        throw new errorHandler_1.AppError(404, "Group not found");
    const rows = await prisma_1.prisma.message.findMany({
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
    const chatDek = await (0, chatEncryption_service_1.getChatDek)(group.chatId);
    const messages = rows
        .map((row) => ({
        id: row.id,
        chatId: row.chatId,
        groupId: row.groupId,
        senderId: row.senderId,
        createdAt: row.createdAt,
        type: row.type,
        content: (0, ai_memory_helpers_1.getMessagePlainText)(row, chatDek?.dek ?? null),
        mediaUrl: row.mediaUrl,
        meta: row.meta ?? null,
    }))
        .filter((item) => item.content || item.mediaUrl)
        .reverse();
    if (!messages.length)
        return null;
    const combined = (0, ai_memory_helpers_1.normalizeText)(messages.map((item) => item.content ?? "").join("\n"));
    const summaryTitle = `Weekly summary ${new Date().toISOString().slice(0, 10)}`;
    const summaryText = (0, ai_memory_helpers_1.clampText)(combined, 320);
    const fingerprint = (0, ai_memory_helpers_1.createFingerprint)("group-summary", groupId, summaryText);
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
    await (0, ai_memory_embeddings_1.storeEmbedding)({
        ownerType: "GROUP_INSIGHT",
        ownerId: insight.id,
        textContent: `${insight.title}\n${insight.shortSummary}\n${insight.normalizedContent}`,
    });
    return insight;
};
const getGroupInsights = async (userId, groupId, limit) => {
    assertAiMemoryEnabled();
    await group_service_1.groupService.requireGroupRole(groupId, userId);
    await buildOrRefreshGroupSummary(groupId);
    return prismaAny.groupInsight.findMany({
        where: { groupId },
        orderBy: { updatedAt: "desc" },
        take: limit,
    });
};
const getGroupDecisions = async (userId, groupId, limit) => {
    assertAiMemoryEnabled();
    await group_service_1.groupService.requireGroupRole(groupId, userId);
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
const getGroupTasks = async (userId, groupId, limit) => {
    assertAiMemoryEnabled();
    await group_service_1.groupService.requireGroupRole(groupId, userId);
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
const assembleContext = async (input) => {
    const sources = [];
    const queryEmbedding = await (0, ai_memory_embeddings_1.embedText)(input.query);
    let selectedMessage = null;
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
            snippet: (0, ai_memory_helpers_1.clampText)(selectedMessage.content ?? selectedMessage.mediaUrl ?? "", 200),
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
        await group_service_1.groupService.requireGroupRole(groupId, input.userId);
        const group = await prisma_1.prisma.group.findUnique({
            where: { id: groupId },
            select: { chatId: true },
        });
        if (!group)
            throw new errorHandler_1.AppError(404, "Group not found");
        chatId = group.chatId;
    }
    if (chatId) {
        await chat_service_1.chatService.assertParticipant(input.userId, chatId);
    }
    const recentMessages = chatId ? await loadMessagesForExtraction(input.userId, { chatId }) : [];
    recentMessages
        .filter((message) => message.id !== selectedMessage?.id)
        .slice(-12)
        .map((message, index, arr) => {
        const content = message.content ?? message.mediaUrl ?? "";
        const semanticScore = (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, (0, ai_memory_helpers_1.buildHashEmbedding)(content));
        const recency = (0, ai_memory_helpers_1.recencyScore)(message.createdAt, { horizonDays: 14 });
        const score = (0, ai_memory_helpers_1.scoreTextRelevance)(input.query, content, semanticScore, recency);
        return {
            sourceType: "MESSAGE",
            sourceId: message.id,
            title: `Recent message ${index + 1}/${arr.length}`,
            snippet: (0, ai_memory_helpers_1.clampText)(content, 220),
            relevanceScore: score,
            section: "recent_conversation",
            meta: {
                chatId: message.chatId,
                groupId: message.groupId,
                createdAt: message.createdAt.toISOString(),
                scoreBreakdown: {
                    keyword: (0, ai_memory_helpers_1.keywordScore)(input.query, content),
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
    memories.forEach((memory, index) => {
        sources.push({
            sourceType: "MEMORY",
            sourceId: memory.id,
            title: memory.title,
            snippet: (0, ai_memory_helpers_1.clampText)(memory.shortSummary ?? memory.normalizedContent, 180),
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
        pinned.forEach((memory) => {
            sources.push({
                sourceType: "MEMORY",
                sourceId: memory.id,
                title: `${memory.title} (Pinned)`,
                snippet: (0, ai_memory_helpers_1.clampText)(memory.shortSummary ?? memory.normalizedContent, 180),
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
            .map((insight, index) => {
            const insightText = `${insight.title}\n${insight.shortSummary}\n${insight.normalizedContent ?? ""}`;
            const semanticScore = Array.isArray(insight.embeddingVector)
                ? (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, insight.embeddingVector)
                : 0;
            const recency = (0, ai_memory_helpers_1.recencyScore)(new Date(insight.updatedAt), { horizonDays: 45 });
            const score = (0, ai_memory_helpers_1.combineScores)([
                [(0, ai_memory_helpers_1.keywordScore)(input.query, insightText), 0.45],
                [semanticScore, 0.35],
                [recency, 0.2],
            ]);
            return {
                sourceType: "GROUP_INSIGHT",
                sourceId: insight.id,
                title: insight.title,
                snippet: (0, ai_memory_helpers_1.clampText)(insight.shortSummary, 180),
                relevanceScore: score + Math.max(0, 0.03 - index * 0.005),
                section: "group_insights",
                meta: {
                    groupId,
                    insightType: insight.type ?? "GROUP_KNOWLEDGE",
                    scoreBreakdown: {
                        keyword: (0, ai_memory_helpers_1.keywordScore)(input.query, insightText),
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
        const filename = (0, ai_memory_helpers_1.filenameFromUrl)(file.url);
        const messageMeta = file.message?.meta && typeof file.message.meta === "object"
            ? file.message.meta
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
            const chunks = (0, ai_memory_helpers_1.chunkText)(extractedTextCandidates, 700, 120);
            if (chunks.length > 0) {
                const createdChunks = [];
                for (let index = 0; index < chunks.length; index += 1) {
                    const stored = await (0, ai_memory_embeddings_1.storeEmbedding)({
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
                    if (stored)
                        createdChunks.push(stored);
                }
                chunkRecords = createdChunks;
            }
        }
        chunkRecords
            .map((chunk) => {
            const semanticScore = Array.isArray(chunk.vector)
                ? (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, chunk.vector)
                : 0;
            const recency = (0, ai_memory_helpers_1.recencyScore)(new Date(file.message.createdAt), { horizonDays: 30 });
            const score = (0, ai_memory_helpers_1.scoreTextRelevance)(input.query, chunk.textContent, semanticScore, recency);
            return {
                sourceType: "FILE",
                sourceId: `${file.id}#${chunk.chunkIndex}`,
                title: `${filename} · chunk ${Number(chunk.chunkIndex) + 1}`,
                snippet: (0, ai_memory_helpers_1.clampText)(chunk.textContent, 220),
                relevanceScore: score,
                section: "relevant_files",
                meta: {
                    fileId: file.id,
                    messageId: file.message.id,
                    chatId: file.message.chatId,
                    groupId: file.message.groupId,
                    kind: file.kind,
                    filename,
                    chunkIndex: chunk.chunkIndex,
                    scoreBreakdown: {
                        keyword: (0, ai_memory_helpers_1.keywordScore)(input.query, chunk.textContent),
                        semantic: semanticScore,
                        recency,
                    },
                    rankingReason: "file_chunk_match",
                },
            };
        })
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 4)
            .forEach((candidate) => {
            sources.push({
                ...candidate,
            });
        });
    }
    const deduped = sources.filter((item, index, array) => array.findIndex((candidate) => candidate.sourceType === item.sourceType && candidate.sourceId === item.sourceId) === index);
    const ranked = deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const assembled = (0, ai_memory_helpers_1.assembleRankedContext)({
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
            tokenCost: source.tokenCost ?? (0, ai_memory_helpers_1.estimateTokens)(source.snippet),
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
const localContextFallback = (mode, query, promptContext) => {
    const intro = mode === "SEARCH_MEMORY"
        ? "Memory search results"
        : mode === "PROJECT_UPDATE"
            ? "Project update"
            : "Context-aware answer";
    return `${intro}\n\nQuestion: ${query}\n\nRelevant context:\n${promptContext || "No strong context found."}`;
};
const respondWithContext = async (userId, input) => {
    assertAiMemoryEnabled();
    const assembled = await assembleContext({
        userId,
        chatId: input.chatId,
        groupId: input.groupId,
        selectedMessageId: input.selectedMessageId,
        query: input.query,
        pinnedMemoryIds: input.pinnedMemoryIds,
        mode: input.mode,
        tokenBudget: input.tokenBudget ?? ai_memory_helpers_1.DEFAULT_CONTEXT_TOKEN_BUDGET,
    });
    let replyText = "";
    let usage = {
        promptTokens: (0, ai_memory_helpers_1.estimateTokens)(assembled.promptContext),
        completionTokens: 0,
        totalTokens: (0, ai_memory_helpers_1.estimateTokens)(assembled.promptContext),
    };
    try {
        const selection = input.model?.trim() ? ai_service_1.aiService.parseModelSelection(input.model) : null;
        const available = ai_service_1.aiService.listEnabledModels();
        const provider = selection?.provider ?? available[0];
        const version = selection?.version ?? ai_service_1.aiService.listProviderVersions(provider)[0];
        const messages = [
            {
                role: "system",
                content: [
                    "You are the platform knowledge engine.",
                    (0, ai_memory_helpers_1.buildModeInstruction)(input.mode),
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
        const result = await ai_service_1.aiService.createChatCompletion({
            model: provider,
            modelVersion: version,
            messages,
            temperature: 0.2,
            maxTokens: 600,
        });
        replyText = result.text;
        usage = result.usage;
    }
    catch {
        replyText = localContextFallback(input.mode, input.query, assembled.promptContext);
        usage = {
            promptTokens: (0, ai_memory_helpers_1.estimateTokens)(assembled.promptContext),
            completionTokens: (0, ai_memory_helpers_1.estimateTokens)(replyText),
            totalTokens: (0, ai_memory_helpers_1.estimateTokens)(assembled.promptContext) + (0, ai_memory_helpers_1.estimateTokens)(replyText),
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
            tokenBudget: input.tokenBudget ?? ai_memory_helpers_1.DEFAULT_CONTEXT_TOKEN_BUDGET,
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
const ensureKnowledgeAndInsightEmbeddings = async (userId) => {
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
            await (0, ai_memory_embeddings_1.storeEmbedding)({
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
            await (0, ai_memory_embeddings_1.storeEmbedding)({
                ownerType: "GROUP_INSIGHT",
                ownerId: item.id,
                textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
            });
        }
    }
};
const semanticSearch = async (userId, input) => {
    assertSemanticSearchEnabled();
    if (input.chatId)
        await chat_service_1.chatService.assertParticipant(userId, input.chatId);
    if (input.groupId)
        await group_service_1.groupService.requireGroupRole(input.groupId, userId);
    await Promise.all([ensureMemoryEmbeddings(userId), ensureKnowledgeAndInsightEmbeddings(userId)]);
    const scopes = await getAccessibleScopes(userId);
    const queryEmbedding = await (0, ai_memory_embeddings_1.embedText)(input.q);
    const [memories, knowledge, insights] = await Promise.all([
        prismaAny.userMemory.findMany({
            where: { userId, forgottenAt: null },
            include: { sourceLinks: true },
            take: ai_memory_helpers_1.MAX_SEARCH_CANDIDATES,
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
            take: ai_memory_helpers_1.MAX_SEARCH_CANDIDATES,
            orderBy: { updatedAt: "desc" },
        }),
        prismaAny.groupInsight.findMany({
            where: { groupId: { in: scopes.groupIds.length ? scopes.groupIds : ["__none__"] } },
            take: ai_memory_helpers_1.MAX_SEARCH_CANDIDATES,
            orderBy: { updatedAt: "desc" },
        }),
    ]);
    const messageCandidates = input.chatId
        ? await loadMessagesForExtraction(userId, { chatId: input.chatId })
        : [];
    const embeddingRecords = await prismaAny.embeddingRecord.findMany({
        where: {
            OR: [
                { ownerType: "MEMORY", ownerId: { in: memories.map((item) => item.id) } },
                { ownerType: "KNOWLEDGE", ownerId: { in: knowledge.map((item) => item.id) } },
                { ownerType: "GROUP_INSIGHT", ownerId: { in: insights.map((item) => item.id) } },
            ],
        },
    });
    const embeddingKey = (ownerType, ownerId) => `${ownerType}:${ownerId}`;
    const embeddingByKey = new Map(embeddingRecords.map((item) => [embeddingKey(item.ownerType, item.ownerId), item]));
    const results = [];
    memories.forEach((item) => {
        const record = embeddingByKey.get(embeddingKey("MEMORY", item.id));
        const vectorScore = Array.isArray(record?.vector)
            ? (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, record.vector)
            : 0;
        const textScore = (0, ai_memory_helpers_1.keywordScore)(input.q, `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
        results.push({
            id: item.id,
            title: item.title,
            snippet: (0, ai_memory_helpers_1.clampText)(item.shortSummary, 180),
            resultType: "memory",
            sourceLocation: { chatId: item.sourceConversationId, groupId: item.sourceGroupId },
            date: item.updatedAt.toISOString(),
            relevanceScore: vectorScore * 0.7 + textScore * 0.3,
        });
    });
    knowledge.forEach((item) => {
        const resultType = item.type === "DECISION" ? "decision" : item.type === "TASK" ? "task" : "knowledge";
        const record = embeddingByKey.get(embeddingKey("KNOWLEDGE", item.id));
        const vectorScore = Array.isArray(record?.vector)
            ? (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, record.vector)
            : 0;
        const textScore = (0, ai_memory_helpers_1.keywordScore)(input.q, `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
        results.push({
            id: item.id,
            title: item.title,
            snippet: (0, ai_memory_helpers_1.clampText)(item.shortSummary, 180),
            resultType,
            sourceLocation: {
                chatId: item.sourceConversationId,
                groupId: item.sourceGroupId,
                messageIds: item.sourceLinks.map((link) => link.messageId).filter(Boolean),
            },
            date: item.updatedAt.toISOString(),
            relevanceScore: vectorScore * 0.7 + textScore * 0.3,
        });
    });
    insights.forEach((item) => {
        const record = embeddingByKey.get(embeddingKey("GROUP_INSIGHT", item.id));
        const vectorScore = Array.isArray(record?.vector)
            ? (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, record.vector)
            : 0;
        const textScore = (0, ai_memory_helpers_1.keywordScore)(input.q, `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`);
        results.push({
            id: item.id,
            title: item.title,
            snippet: (0, ai_memory_helpers_1.clampText)(item.shortSummary, 180),
            resultType: "knowledge",
            sourceLocation: { groupId: item.groupId },
            date: item.updatedAt.toISOString(),
            relevanceScore: vectorScore * 0.7 + textScore * 0.3,
        });
    });
    messageCandidates.forEach((item) => {
        const content = item.content ?? item.mediaUrl ?? "";
        if (!content)
            return;
        const textScore = (0, ai_memory_helpers_1.keywordScore)(input.q, content);
        const vectorScore = (0, ai_memory_helpers_1.cosineSimilarity)(queryEmbedding, (0, ai_memory_helpers_1.buildHashEmbedding)(content));
        results.push({
            id: item.id,
            title: (0, ai_memory_helpers_1.clampText)(content, 80),
            snippet: (0, ai_memory_helpers_1.clampText)(content, 180),
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
    const groups = filtered.reduce((acc, item) => {
        acc[item.resultType] = [...(acc[item.resultType] ?? []), item];
        return acc;
    }, {});
    return {
        query: input.q,
        groups: Object.entries(groups).map(([type, items]) => ({ type, items })),
    };
};
const runEmbeddingJob = async (payload) => {
    const ownerType = String(payload.ownerType ?? "");
    const ownerId = String(payload.ownerId ?? "");
    if (!ownerType || !ownerId)
        return;
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
        if (!file || !file.message)
            return;
        const messageMeta = file.message.meta && typeof file.message.meta === "object"
            ? file.message.meta
            : null;
        const sourceText = [
            typeof messageMeta?.extractedText === "string" ? messageMeta.extractedText : "",
            typeof messageMeta?.fileText === "string" ? messageMeta.fileText : "",
            typeof messageMeta?.ocrText === "string" ? messageMeta.ocrText : "",
            file.message.content ?? "",
            file.message.text ?? "",
            `${file.kind} ${(0, ai_memory_helpers_1.filenameFromUrl)(file.url)}`,
        ]
            .filter(Boolean)
            .join("\n");
        const chunks = (0, ai_memory_helpers_1.chunkText)(sourceText, 700, 120);
        for (let index = 0; index < chunks.length; index += 1) {
            await (0, ai_memory_embeddings_1.storeEmbedding)({
                ownerType: "FILE",
                ownerId,
                chunkIndex: index,
                textContent: chunks[index],
                meta: {
                    chatId: file.message.chatId,
                    groupId: file.message.groupId,
                    messageId: file.message.id,
                    filename: (0, ai_memory_helpers_1.filenameFromUrl)(file.url),
                    kind: file.kind,
                },
            });
        }
        return;
    }
    if (ownerType === "KNOWLEDGE") {
        const item = await prismaAny.knowledgeItem.findUnique({ where: { id: ownerId } });
        if (!item)
            return;
        await (0, ai_memory_embeddings_1.storeEmbedding)({
            ownerType: "KNOWLEDGE",
            ownerId,
            textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
        });
        return;
    }
    if (ownerType === "MEMORY") {
        const item = await prismaAny.userMemory.findUnique({ where: { id: ownerId } });
        if (!item || item.forgottenAt)
            return;
        await (0, ai_memory_embeddings_1.storeEmbedding)({
            ownerType: "MEMORY",
            ownerId,
            textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
        });
        return;
    }
    if (ownerType === "GROUP_INSIGHT") {
        const item = await prismaAny.groupInsight.findUnique({ where: { id: ownerId } });
        if (!item)
            return;
        await (0, ai_memory_embeddings_1.storeEmbedding)({
            ownerType: "GROUP_INSIGHT",
            ownerId,
            textContent: `${item.title}\n${item.shortSummary}\n${item.normalizedContent}`,
        });
    }
};
const runKnowledgeExtractionJob = async (payload) => {
    const userId = String(payload.userId ?? "");
    if (!userId)
        return;
    const messageIds = Array.isArray(payload.messageIds)
        ? payload.messageIds.map((item) => String(item)).filter(Boolean)
        : [];
    const chatId = payload.chatId ? String(payload.chatId) : undefined;
    const groupId = payload.groupId ? String(payload.groupId) : undefined;
    const messages = await loadMessagesForExtraction(userId, { chatId, groupId, messageIds });
    if (!messages.length)
        return;
    await createKnowledgeAndMemory({
        userId,
        messages,
        saveToMemory: payload.saveToMemory !== false,
    });
};
const runGroupSummaryJob = async (payload) => {
    const groupId = String(payload.groupId ?? "");
    if (!groupId)
        return;
    await buildOrRefreshGroupSummary(groupId);
};
const enqueueAutoKnowledgeExtraction = async (input) => {
    if (!env_1.env.FEATURE_AI_MEMORY)
        return;
    await jobs_service_1.jobsService.enqueueJob({
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
exports.aiMemoryService = {
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
