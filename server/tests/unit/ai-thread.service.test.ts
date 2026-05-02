import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.MESSAGE_KEK_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.MESSAGE_KEK_ID = "primary-v1";
process.env.HEALTH_TOKEN = "test-health-token";
delete process.env.MESSAGE_KEK_MAP_JSON;

const prismaMock = {
  aiThread: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  aiTurn: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  aiJob: {
    create: vi.fn(),
  },
  message: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};

const chatServiceMock = {
  assertParticipant: vi.fn(),
};

const messageServiceMock = {
  createMessage: vi.fn(),
};

const creditsServiceMock = {
  hasActiveSubscription: vi.fn(),
};

const rateLimitMock = {
  enforceAiThreadRateLimit: vi.fn(),
};

const queueMock = {
  aiThreadQueue: {
    enqueue: vi.fn(),
  },
};

vi.mock("../../src/config/prisma", () => ({
  prisma: prismaMock,
}));
vi.mock("../../src/modules/chat/chat.service", () => ({
  chatService: chatServiceMock,
}));
vi.mock("../../src/modules/message/message.service", () => ({
  messageService: messageServiceMock,
}));
vi.mock("../../src/modules/credits/credits.service", () => ({
  creditsService: creditsServiceMock,
}));
vi.mock("../../src/modules/ai/ai-thread.rate-limit", () => rateLimitMock);
vi.mock("../../src/modules/ai/ai-thread.queue", () => queueMock);

describe("aiThreadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatServiceMock.assertParticipant.mockResolvedValue(undefined);
    creditsServiceMock.hasActiveSubscription.mockResolvedValue(false);
    rateLimitMock.enforceAiThreadRateLimit.mockResolvedValue(undefined);
  });

  it("blocks reading thread for non-owner", async () => {
    prismaMock.aiThread.findUnique.mockResolvedValue({
      id: "thread-1",
      chatId: "chat-1",
      requesterId: "owner-1",
      targetMessageId: null,
    });

    const { aiThreadService } = await import("../../src/modules/ai/ai-thread.service");
    await expect(
      aiThreadService.getThread({ requesterId: "other-user", threadId: "thread-1" })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("creates turn and enqueues job", async () => {
    prismaMock.aiThread.findUnique.mockResolvedValue({
      id: "thread-1",
      chatId: "chat-1",
      requesterId: "user-1",
      targetMessageId: "msg-1",
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        aiTurn: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              id: "turn-user",
              threadId: "thread-1",
              role: "USER",
              content: "summarize this",
              meta: null,
              createdAt: new Date("2026-02-28T10:00:00.000Z"),
            })
            .mockResolvedValueOnce({
              id: "turn-ai",
              threadId: "thread-1",
              role: "AI",
              content: "Thinking...",
              meta: { status: "QUEUED" },
              createdAt: new Date("2026-02-28T10:00:01.000Z"),
            }),
          update: vi.fn().mockResolvedValue({
            id: "turn-ai",
            threadId: "thread-1",
            role: "AI",
            content: "Thinking...",
            meta: { status: "QUEUED", jobId: "job-1" },
            createdAt: new Date("2026-02-28T10:00:01.000Z"),
          }),
        },
        aiJob: {
          create: vi.fn().mockResolvedValue({
            id: "job-1",
          }),
        },
        aiThread: {
          update: vi.fn().mockResolvedValue({
            id: "thread-1",
          }),
        },
      };
      return callback(tx);
    });

    const { aiThreadService } = await import("../../src/modules/ai/ai-thread.service");
    const result = await aiThreadService.createTurnAndEnqueue({
      requesterId: "user-1",
      threadId: "thread-1",
      prompt: "@ai summarize this",
    });

    expect(result.jobId).toBe("job-1");
    expect(queueMock.aiThreadQueue.enqueue).toHaveBeenCalledWith("job-1");
    expect(result.userTurn.role).toBe("USER");
    expect(result.aiTurnPlaceholder.role).toBe("AI");
  });

  it("shares and forwards AI turn as normal messages", async () => {
    prismaMock.aiThread.findUnique.mockResolvedValue({
      id: "thread-1",
      chatId: "chat-1",
      requesterId: "user-1",
      targetMessageId: "msg-1",
    });
    prismaMock.aiTurn.findUnique.mockResolvedValue({
      id: "turn-ai",
      threadId: "thread-1",
      role: "AI",
      content: "Result",
    });
    messageServiceMock.createMessage.mockResolvedValue({ id: "message-1" });

    const { aiThreadService } = await import("../../src/modules/ai/ai-thread.service");
    const shared = await aiThreadService.shareAiTurnToThreadChat({
      requesterId: "user-1",
      threadId: "thread-1",
      aiTurnId: "turn-ai",
    });
    expect(shared.message).toEqual({ id: "message-1" });

    await aiThreadService.forwardAiTurnToChat({
      requesterId: "user-1",
      threadId: "thread-1",
      aiTurnId: "turn-ai",
      toChatId: "chat-2",
    });

    expect(chatServiceMock.assertParticipant).toHaveBeenCalledWith("user-1", "chat-2");
    expect(messageServiceMock.createMessage).toHaveBeenCalledTimes(2);
  });
});

