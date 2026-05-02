import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.MESSAGE_KEK_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.MESSAGE_KEK_ID = "primary-v1";
process.env.HEALTH_TOKEN = "test-health-token";
delete process.env.MESSAGE_KEK_MAP_JSON;

const prismaMock = {
  chatParticipant: {
    findMany: vi.fn(),
  },
  groupMember: {
    findMany: vi.fn(),
  },
  message: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  messageMedia: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  group: {
    findUnique: vi.fn(),
  },
};

const prismaAnyMock = {
  memoryPreference: {
    upsert: vi.fn(),
  },
  knowledgeItem: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  knowledgeSourceLink: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  userMemory: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  userMemorySourceLink: {
    createMany: vi.fn(),
  },
  embeddingRecord: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  groupInsight: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  aIContextSession: {
    create: vi.fn(),
  },
  aIResponseSource: {
    createMany: vi.fn(),
  },
};

const chatServiceMock = {
  assertParticipant: vi.fn(),
};

const groupServiceMock = {
  requireGroupRole: vi.fn(),
};

const jobsServiceMock = {
  enqueueJob: vi.fn(),
};

const aiServiceMock = {
  parseModelSelection: vi.fn(),
  listEnabledModels: vi.fn(),
  listProviderVersions: vi.fn(),
  createChatCompletion: vi.fn(),
};

const embeddingMock = {
  embedText: vi.fn(),
  storeEmbedding: vi.fn(),
};

const chatDekMock = {
  getChatDek: vi.fn(),
};

vi.mock("../../src/config/prisma", () => ({
  prisma: Object.assign(prismaMock, prismaAnyMock),
}));
vi.mock("../../src/modules/chat/chat.service", () => ({
  chatService: chatServiceMock,
}));
vi.mock("../../src/modules/group/group.service", () => ({
  groupService: groupServiceMock,
}));
vi.mock("../../src/modules/jobs/jobs.service", () => ({
  jobsService: jobsServiceMock,
}));
vi.mock("../../src/modules/ai/ai.service", () => ({
  aiService: aiServiceMock,
}));
vi.mock("../../src/modules/ai-memory/ai-memory.embeddings", () => embeddingMock);
vi.mock("../../src/security/chatEncryption.service", () => chatDekMock);

describe("aiMemoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaAnyMock.memoryPreference.upsert.mockResolvedValue({
      excludedChatIds: [],
      excludedGroupIds: [],
      autoMemoryEnabled: true,
    });
    prismaAnyMock.knowledgeItem.upsert.mockResolvedValue({ id: "knowledge-1" });
    prismaAnyMock.userMemory.create.mockResolvedValue({ id: "memory-1" });
    prismaAnyMock.knowledgeSourceLink.deleteMany.mockResolvedValue(undefined);
    prismaAnyMock.knowledgeSourceLink.createMany.mockResolvedValue(undefined);
    prismaAnyMock.userMemorySourceLink.createMany.mockResolvedValue(undefined);
    jobsServiceMock.enqueueJob.mockResolvedValue(undefined);
    embeddingMock.embedText.mockResolvedValue([0.5, 0.5]);
    embeddingMock.storeEmbedding.mockResolvedValue(undefined);
    aiServiceMock.listEnabledModels.mockImplementation(() => {
      throw new Error("no providers");
    });
    prismaAnyMock.aIContextSession.create.mockResolvedValue({ id: "ctx-1" });
    prismaAnyMock.aIResponseSource.createMany.mockResolvedValue(undefined);
    prismaMock.chatParticipant.findMany.mockResolvedValue([{ chatId: "chat-1" }]);
    prismaMock.groupMember.findMany.mockResolvedValue([]);
    chatServiceMock.assertParticipant.mockResolvedValue(undefined);
    groupServiceMock.requireGroupRole.mockResolvedValue(undefined);
    chatDekMock.getChatDek.mockResolvedValue({ dek: null });
    prismaAnyMock.userMemory.findMany.mockResolvedValue([]);
    prismaAnyMock.embeddingRecord.findMany.mockResolvedValue([]);
    prismaAnyMock.knowledgeItem.findMany.mockResolvedValue([]);
    prismaAnyMock.groupInsight.findMany.mockResolvedValue([]);
    prismaMock.message.findMany.mockResolvedValue([]);
    prismaMock.messageMedia.findMany.mockResolvedValue([]);
    prismaMock.messageMedia.findUnique.mockResolvedValue(null);
    prismaAnyMock.knowledgeItem.findMany.mockResolvedValue([]);
    prismaAnyMock.embeddingRecord.findFirst.mockResolvedValue(null);
  });

  it("creates knowledge and memory records and queues embedding jobs", async () => {
    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");
    const result = await aiMemoryService.createKnowledgeAndMemory({
      userId: "user-1",
      messages: [
        {
          id: "message-1",
          chatId: "chat-1",
          groupId: null,
          senderId: "user-1",
          createdAt: new Date("2026-04-15T10:00:00.000Z"),
          type: "TEXT",
          content: "We decided to follow up on pricing next week.",
          mediaUrl: null,
          meta: null,
        },
      ],
      saveToMemory: true,
    });

    expect(result.knowledgeItems).toHaveLength(3);
    expect(result.memoryItems).toHaveLength(3);
    expect(jobsServiceMock.enqueueJob).toHaveBeenCalled();
  });

  it("blocks patching private knowledge owned by another user", async () => {
    prismaAnyMock.knowledgeItem.findUnique.mockResolvedValue({
      id: "knowledge-2",
      visibilityScope: "PRIVATE",
      createdByUserId: "owner-1",
      authorUserId: "owner-1",
    });
    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");

    await expect(
      aiMemoryService.patchKnowledge("user-2", "knowledge-2", { reviewState: "CONFIRMED" })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("falls back to a local context response when no AI providers are enabled", async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      id: "message-1",
      chatId: "chat-1",
      groupId: null,
      senderId: "user-1",
      createdAt: new Date("2026-04-15T10:00:00.000Z"),
      type: "TEXT",
      content: "Discuss pricing with the vendor next week.",
      text: "Discuss pricing with the vendor next week.",
      cipherText: null,
      iv: null,
      authTag: null,
      mediaUrl: null,
      meta: null,
      deletedForEveryone: false,
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: "message-1",
        chatId: "chat-1",
        groupId: null,
        senderId: "user-1",
        createdAt: new Date("2026-04-15T10:00:00.000Z"),
        type: "TEXT",
        content: "Discuss pricing with the vendor next week.",
        text: "Discuss pricing with the vendor next week.",
        cipherText: null,
        iv: null,
        authTag: null,
        mediaUrl: null,
        meta: null,
        deletedForEveryone: false,
        kind: "USER",
      },
    ]);
    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");
    const result = await aiMemoryService.respondWithContext("user-1", {
      selectedMessageId: "message-1",
      query: "What did we say about pricing?",
      mode: "SEARCH_MEMORY",
    });

    expect(result.contextSessionId).toBe("ctx-1");
    expect(result.reply.text).toContain("Memory search results");
    expect(prismaAnyMock.aIResponseSource.createMany).toHaveBeenCalled();
  });

  it("checks chat participation before semantic search on a chat scope", async () => {
    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");
    await aiMemoryService.semanticSearch("user-1", {
      q: "pricing",
      chatId: "chat-1",
      limit: 10,
    });

    expect(chatServiceMock.assertParticipant).toHaveBeenCalledWith("user-1", "chat-1");
  });

  it("assembles ranked context with selected message first, file chunks, and token budgeting", async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      id: "message-selected",
      chatId: "chat-1",
      groupId: null,
      senderId: "user-1",
      createdAt: new Date("2026-04-15T10:00:00.000Z"),
      type: "TEXT",
      content: "Please review the pricing workbook attachment before tomorrow.",
      text: "Please review the pricing workbook attachment before tomorrow.",
      cipherText: null,
      iv: null,
      authTag: null,
      mediaUrl: null,
      meta: null,
      deletedForEveryone: false,
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: "message-old",
        chatId: "chat-1",
        groupId: null,
        senderId: "user-1",
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        type: "TEXT",
        content: "Older conversation about onboarding factories.",
        text: "Older conversation about onboarding factories.",
        cipherText: null,
        iv: null,
        authTag: null,
        mediaUrl: null,
        meta: null,
        deletedForEveryone: false,
        kind: "USER",
      },
      {
        id: "message-recent",
        chatId: "chat-1",
        groupId: null,
        senderId: "user-1",
        createdAt: new Date("2026-04-15T09:58:00.000Z"),
        type: "TEXT",
        content: "Pricing workbook has the latest vendor quote and risk notes.",
        text: "Pricing workbook has the latest vendor quote and risk notes.",
        cipherText: null,
        iv: null,
        authTag: null,
        mediaUrl: null,
        meta: null,
        deletedForEveryone: false,
        kind: "USER",
      },
    ]);
    prismaAnyMock.userMemory.findMany.mockResolvedValue([
      {
        id: "memory-1",
        title: "Vendor pricing history",
        shortSummary: "Past conversations about pricing reviews and risk.",
        normalizedContent: "Past conversations about pricing reviews and risk.",
        sourceConversationId: "chat-1",
        sourceGroupId: null,
        pinnedAt: null,
        forgottenAt: null,
        updatedAt: new Date("2026-04-14T12:00:00.000Z"),
        createdAt: new Date("2026-04-14T12:00:00.000Z"),
        sourceLinks: [],
      },
    ]);
    prismaMock.messageMedia.findMany.mockResolvedValue([
      {
        id: "file-1",
        messageId: "message-file",
        uploaderId: "user-1",
        kind: "DOCUMENT",
        url: "https://cdn.example.com/files/pricing-workbook.pdf",
        sizeBytes: 1024,
        createdAt: new Date("2026-04-15T09:59:00.000Z"),
        message: {
          id: "message-file",
          chatId: "chat-1",
          groupId: null,
          createdAt: new Date("2026-04-15T09:59:00.000Z"),
          content: "Pricing workbook",
          text: "Pricing workbook",
          meta: { extractedText: "Workbook includes vendor quote, payment terms, and open pricing risks." },
        },
      },
    ]);
    prismaAnyMock.embeddingRecord.findMany.mockImplementation((args: any) => {
      if (args?.where?.ownerType === "MEMORY") {
        return Promise.resolve([{ ownerId: "memory-1", vector: [0.95, 0.05] }]);
      }
      if (args?.where?.ownerType === "FILE") {
        return Promise.resolve([
          {
            ownerType: "FILE",
            ownerId: "file-1",
            chunkIndex: 0,
            textContent: "Workbook includes vendor quote, payment terms, and open pricing risks.",
            vector: [0.98, 0.02],
          },
        ]);
      }
      return Promise.resolve([]);
    });
    embeddingMock.embedText.mockResolvedValue([1, 0]);

    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");
    const result = await aiMemoryService.assembleContext({
      userId: "user-1",
      selectedMessageId: "message-selected",
      query: "pricing workbook risks",
      mode: "EXPLAIN",
      tokenBudget: 180,
    });

    expect(result.usedTokens).toBeLessThanOrEqual(180);
    expect(result.sources[0]).toMatchObject({
      sourceType: "MESSAGE",
      sourceId: "message-selected",
    });
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "FILE",
          meta: expect.objectContaining({
            fileId: "file-1",
            section: "relevant_files",
          }),
        }),
      ])
    );
  });

  it("returns response source metadata with ranking and section details", async () => {
    prismaMock.message.findUnique.mockResolvedValue({
      id: "message-1",
      chatId: "chat-1",
      groupId: null,
      senderId: "user-1",
      createdAt: new Date("2026-04-15T10:00:00.000Z"),
      type: "TEXT",
      content: "Explain the pricing discussion.",
      text: "Explain the pricing discussion.",
      cipherText: null,
      iv: null,
      authTag: null,
      mediaUrl: null,
      meta: null,
      deletedForEveryone: false,
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: "message-1",
        chatId: "chat-1",
        groupId: null,
        senderId: "user-1",
        createdAt: new Date("2026-04-15T10:00:00.000Z"),
        type: "TEXT",
        content: "Explain the pricing discussion.",
        text: "Explain the pricing discussion.",
        cipherText: null,
        iv: null,
        authTag: null,
        mediaUrl: null,
        meta: null,
        deletedForEveryone: false,
        kind: "USER",
      },
    ]);
    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");
    const result = await aiMemoryService.respondWithContext("user-1", {
      selectedMessageId: "message-1",
      query: "Explain the pricing discussion",
      mode: "EXPLAIN",
      tokenBudget: 300,
    });

    expect(result.sourcesUsed[0]?.meta).toEqual(
      expect.objectContaining({
        rank: 1,
        section: expect.any(String),
        tokenCost: expect.any(Number),
      })
    );
  });

  it("rejects context assembly for an unauthorized group scope", async () => {
    groupServiceMock.requireGroupRole.mockRejectedValueOnce({ statusCode: 403, message: "Forbidden" });
    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");

    await expect(
      aiMemoryService.respondWithContext("user-1", {
        groupId: "group-secret",
        query: "What changed?",
        mode: "PROJECT_UPDATE",
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns grouped semantic search results with source attribution", async () => {
    prismaAnyMock.userMemory.findMany.mockResolvedValue([
      {
        id: "memory-1",
        title: "Pricing notes",
        shortSummary: "Vendor pricing follow-up",
        normalizedContent: "Discuss vendor pricing and follow up next week",
        sourceConversationId: "chat-1",
        sourceGroupId: null,
        updatedAt: new Date("2026-04-15T12:00:00.000Z"),
        sourceLinks: [],
        forgottenAt: null,
      },
    ]);
    prismaAnyMock.knowledgeItem.findMany.mockResolvedValue([
      {
        id: "knowledge-1",
        type: "DECISION",
        title: "Pricing decision",
        shortSummary: "We agreed to revisit vendor pricing next week.",
        normalizedContent: "Agreed to revisit vendor pricing next week",
        sourceConversationId: "chat-1",
        sourceGroupId: null,
        updatedAt: new Date("2026-04-15T13:00:00.000Z"),
        sourceLinks: [{ messageId: "message-1" }],
        reviewState: "CONFIRMED",
      },
    ]);
    prismaAnyMock.embeddingRecord.findMany.mockResolvedValue([
      {
        ownerType: "MEMORY",
        ownerId: "memory-1",
        vector: [0.8, 0.2],
      },
      {
        ownerType: "KNOWLEDGE",
        ownerId: "knowledge-1",
        vector: [0.9, 0.1],
      },
    ]);
    embeddingMock.embedText.mockResolvedValue([1, 0]);

    const { aiMemoryService } = await import("../../src/modules/ai-memory/ai-memory.service");
    const result = await aiMemoryService.semanticSearch("user-1", {
      q: "vendor pricing",
      limit: 10,
    });

    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.groups.flatMap((group: any) => group.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "memory-1",
          resultType: "memory",
          sourceLocation: expect.objectContaining({ chatId: "chat-1" }),
        }),
        expect.objectContaining({
          id: "knowledge-1",
          resultType: "decision",
          sourceLocation: expect.objectContaining({ messageIds: ["message-1"] }),
        }),
      ])
    );
  });
});
