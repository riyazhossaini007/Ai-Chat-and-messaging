import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  subscription: { findFirst: vi.fn() },
  userSubscription: { findFirst: vi.fn() },
  entitlementGrant: { findFirst: vi.fn() },
};

vi.mock("../../src/config/prisma", () => ({
  prisma: prismaMock,
}));

describe("featureGateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.userSubscription.findFirst.mockResolvedValue(null);
    prismaMock.entitlementGrant.findFirst.mockResolvedValue(null);
  });

  it("allows access when user has active entitlement grant", async () => {
    prismaMock.entitlementGrant.findFirst.mockResolvedValue({ id: "ent-1" });
    const { featureGateService } = await import("../../src/modules/admin/featureGate.service");
    const allowed = await featureGateService.canUseFeature("user-1", "CALLING");
    expect(allowed).toBe(true);
  });

  it("denies access without paid plan or entitlement", async () => {
    const { featureGateService } = await import("../../src/modules/admin/featureGate.service");
    const allowed = await featureGateService.canUseFeature("user-1", "PRO_ACCESS");
    expect(allowed).toBe(false);
  });
});

