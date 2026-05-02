import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.MESSAGE_KEK_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.MESSAGE_KEK_ID = "primary-v1";
process.env.HEALTH_TOKEN = "test-health-token";
delete process.env.MESSAGE_KEK_MAP_JSON;

const prismaMock = {
  chat: {
    findUnique: vi.fn(),
  },
  message: {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  messageHidden: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  chatParticipant: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const chatServiceMock = {
  assertParticipant: vi.fn(),
};

const privacyGuardMock = {
  isBlocked: vi.fn(),
  canMessage: vi.fn(),
};

const chatEncryptionMock = {
  getOrCreateChatDek: vi.fn(),
  getChatDek: vi.fn(),
};

const reactionServiceMock = {
  buildReactionSummary: vi.fn(),
  buildReactionSummaryMap: vi.fn(),
  getMessageReactionDetails: vi.fn(),
};

vi.mock("../../src/config/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../../src/modules/chat/chat.service", () => ({
  chatService: chatServiceMock,
}));

vi.mock("../../src/modules/privacy/privacy.guard", () => ({
  privacyGuard: privacyGuardMock,
}));

vi.mock("../../src/security/chatEncryption.service", () => chatEncryptionMock);

vi.mock("../../src/modules/message/reaction.service", () => reactionServiceMock);

const encryptWithDek = (plainText: string, dek: Buffer) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipherText: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: tag.toString("base64"),
  };
};

const makeMessageRow = (overrides: Record<string, unknown> = {}) => ({
  id: "msg-1",
  chatId: "chat-1",
  senderId: "user-1",
  kind: "USER",
  content: null,
  text: null,
  cipherText: null,
  iv: null,
  authTag: null,
  algo: null,
  encVersion: 1,
  mediaUrl: null,
  type: "TEXT",
  chatType: "DM",
  groupId: null,
  systemEvent: null,
  systemActorId: null,
  status: "SENT",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  replyToId: null,
  isForwarded: false,
  forwardFromMessageId: null,
  forwardFromSenderId: null,
  deletedForEveryone: false,
  deletedAt: null,
  deletedById: null,
  sender: {
    id: "user-1",
    username: "user1",
    name: "User One",
    avatar: null,
  },
  replyTo: null,
  ...overrides,
});

describe("messageService encryption behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    chatServiceMock.assertParticipant.mockResolvedValue(undefined);
    privacyGuardMock.isBlocked.mockResolvedValue(false);
    privacyGuardMock.canMessage.mockResolvedValue(true);
    reactionServiceMock.buildReactionSummary.mockResolvedValue([]);
    reactionServiceMock.buildReactionSummaryMap.mockResolvedValue(new Map());
    reactionServiceMock.getMessageReactionDetails.mockResolvedValue([]);

    prismaMock.chat.findUnique.mockResolvedValue({
      id: "chat-1",
      type: "DIRECT",
      participants: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prismaMock.message.count.mockResolvedValue(1);
    prismaMock.message.findUnique.mockResolvedValue(null);
    prismaMock.messageHidden.findMany.mockResolvedValue([]);
    prismaMock.message.findMany.mockResolvedValue([]);
    prismaMock.chatParticipant.findMany.mockResolvedValue([]);
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.messageHidden.createMany.mockResolvedValue({ count: 0 });
  });

  it("send message stores encrypted fields and null plaintext", async () => {
    const { messageService } = await import("../../src/modules/message/message.service");
    const dek = crypto.randomBytes(32);
    chatEncryptionMock.getOrCreateChatDek.mockResolvedValue({ dek, encVersion: 1 });

    let capturedCreateData: Record<string, unknown> | null = null;
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        message: {
          create: vi.fn(async (args: { data: Record<string, unknown> }) => {
            capturedCreateData = args.data;
            return makeMessageRow({
              ...args.data,
              id: "msg-created",
              sender: {
                id: "user-1",
                username: "user1",
                name: "User One",
                avatar: null,
              },
            });
          }),
        },
        messageMedia: {
          create: vi.fn(),
        },
        chat: {
          update: vi.fn(),
        },
      };
      return callback(tx);
    });

    const result = await messageService.createMessage({
      userId: "user-1",
      chatId: "chat-1",
      content: "hello secure world",
      type: "TEXT",
    });

    expect(capturedCreateData).not.toBeNull();
    expect(capturedCreateData?.content).toBeNull();
    expect(capturedCreateData?.text).toBeNull();
    expect(capturedCreateData?.cipherText).toEqual(expect.any(String));
    expect(capturedCreateData?.iv).toEqual(expect.any(String));
    expect(capturedCreateData?.authTag).toEqual(expect.any(String));
    expect(result.content).toBe("hello secure world");
    expect((result as Record<string, unknown>).cipherText).toBeUndefined();
  });

  it("fetch messages returns plaintext and does not expose crypto fields", async () => {
    const { messageService } = await import("../../src/modules/message/message.service");
    const dek = crypto.randomBytes(32);
    chatEncryptionMock.getChatDek.mockResolvedValue({ dek, encVersion: 1 });

    const encrypted = encryptWithDek("fetched plaintext", dek);
    prismaMock.message.findMany.mockResolvedValue([
      makeMessageRow({
        id: "msg-fetch",
        cipherText: encrypted.cipherText,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      }),
    ]);

    reactionServiceMock.buildReactionSummaryMap.mockResolvedValue(
      new Map([["msg-fetch", []]])
    );

    const result = await messageService.getChatMessages({
      userId: "user-1",
      chatId: "chat-1",
      limit: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.content).toBe("fetched plaintext");
    expect(result.items[0]?.decryptError).toBe(false);
    expect((result.items[0] as Record<string, unknown>).cipherText).toBeUndefined();
  });

  it("forward decrypts source and re-encrypts for destination chat", async () => {
    const { messageService } = await import("../../src/modules/message/message.service");
    const sourceDek = crypto.randomBytes(32);
    const targetDek = crypto.randomBytes(32);
    const sourceEncrypted = encryptWithDek("forward me", sourceDek);

    prismaMock.message.findMany.mockResolvedValue([
      makeMessageRow({
        id: "msg-source",
        chatId: "chat-source",
        senderId: "user-2",
        content: null,
        text: null,
        cipherText: sourceEncrypted.cipherText,
        iv: sourceEncrypted.iv,
        authTag: sourceEncrypted.authTag,
      }),
    ]);

    chatEncryptionMock.getChatDek.mockImplementation(async (chatId: string) => {
      if (chatId === "chat-source") return { dek: sourceDek, encVersion: 1 };
      if (chatId === "chat-target") return { dek: targetDek, encVersion: 1 };
      return null;
    });
    chatEncryptionMock.getOrCreateChatDek.mockImplementation(async (chatId: string) => {
      if (chatId === "chat-target") return { dek: targetDek, encVersion: 1 };
      return { dek: sourceDek, encVersion: 1 };
    });

    let forwardedCreateData: Record<string, unknown> | null = null;
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        message: {
          create: vi.fn(async (args: { data: Record<string, unknown> }) => {
            forwardedCreateData = args.data;
            return makeMessageRow({
              ...args.data,
              id: "msg-forwarded",
              chatId: "chat-target",
              sender: {
                id: "user-1",
                username: "user1",
                name: "User One",
                avatar: null,
              },
            });
          }),
        },
        messageMedia: {
          create: vi.fn(),
        },
        chat: {
          update: vi.fn(),
        },
      };
      return callback(tx);
    });

    reactionServiceMock.buildReactionSummaryMap.mockResolvedValue(
      new Map([["msg-forwarded", []]])
    );

    const result = await messageService.forwardMessages({
      userId: "user-1",
      messageIds: ["msg-source"],
      targetChatIds: ["chat-target"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe("forward me");
    expect(forwardedCreateData?.cipherText).toEqual(expect.any(String));
    expect(forwardedCreateData?.cipherText).not.toBe(sourceEncrypted.cipherText);
    expect(forwardedCreateData?.content).toBeNull();
    expect(forwardedCreateData?.text).toBeNull();
  });
});
