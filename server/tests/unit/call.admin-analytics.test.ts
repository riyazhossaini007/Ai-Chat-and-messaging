import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  chat: { findUnique: vi.fn(), findFirst: vi.fn() },
  callSession: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  callParticipant: { updateMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  callEvent: { create: vi.fn() },
};

vi.mock("../../src/config/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../../src/config/env", () => ({
  env: { CALLING_ENABLED: true },
}));

vi.mock("../../src/socket", () => ({
  getIO: () => null,
  userRoom: (id: string) => `user:${id}`,
}));

vi.mock("../../src/modules/chat/chat.service", () => ({
  chatService: {
    assertParticipant: vi.fn(),
  },
}));

const verifyWebhookEvent = vi.fn();
vi.mock("../../src/modules/calls/sfu/livekit.service", () => ({
  livekitService: {
    normalizeRoomName: (id: string) => id,
    ensureRoom: vi.fn(),
    mintJoinToken: vi.fn(),
    deleteRoom: vi.fn(),
    verifyWebhookEvent,
  },
}));

describe("callService webhook tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.callSession.findFirst.mockResolvedValue({ id: "call-1", isGroup: true, sfuProvider: "LIVEKIT" });
    prismaMock.callParticipant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.callEvent.create.mockResolvedValue({ id: "evt-1" });
    prismaMock.callSession.update.mockResolvedValue({ id: "call-1" });
  });

  it("updates call session + participant rows on LiveKit participant connected", async () => {
    verifyWebhookEvent.mockResolvedValue({
      event: "participant_connected",
      room: { name: "call-1", metadata: "us-east" },
      participant: { identity: "user-2" },
    });

    const { callService } = await import("../../src/modules/calls/call.service");
    const result = await callService.handleLivekitWebhook(Buffer.from("{}"), "Bearer test");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.callSession.findFirst).toHaveBeenCalled();
    expect(prismaMock.callSession.update).toHaveBeenCalled();
    expect(prismaMock.callParticipant.updateMany).toHaveBeenCalled();
    expect(prismaMock.callEvent.create).toHaveBeenCalled();
  });
});

