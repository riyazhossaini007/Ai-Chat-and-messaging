import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminServiceMock = {
  getOverviewStats: vi.fn(),
};

let currentUser: any = null;

vi.mock("../../src/modules/admin/admin.service", () => ({
  adminService: {
    ...adminServiceMock,
  },
}));

vi.mock("../../src/middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

vi.mock("../../src/middlewares/adminRateLimit", () => ({
  adminRateLimit: (_req: any, _res: any, next: any) => next(),
}));

describe("admin routes access", () => {
  let server: any;
  let baseUrl = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    adminServiceMock.getOverviewStats.mockResolvedValue({
      range: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-07T00:00:00.000Z" },
      users: { totalUsers: 1, newUsers: 1, newUsersByDay: [] },
      activity: { dau: 1, wau: 1, messagesSent: 0, messagesByDay: [] },
      ai: { aiRequests: 0, aiUsers: 0, aiByDay: [], modelBreakdown: {}, tokensIn: 0, tokensOut: 0, estimatedCostUsd: 0 },
      calls: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, droppedCalls: 0, avgDurationSec: 0, successRate: 0, callsByDay: [], failureReasons: [] },
      billing: { paidUsers: 0, complimentaryUsers: 0, trialUsers: 0 },
      moderation: { reportsOpen: 0, reportsResolved: 0, bansActive: 0 },
    });

    const { adminRouter } = await import("../../src/modules/admin/admin.routes");
    const { errorHandler } = await import("../../src/middlewares/errorHandler");
    const app = express();
    app.use(express.json());
    app.use("/admin", adminRouter);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      server = null;
    }
  });

  it("blocks non-admin/moderator users from /admin/*", async () => {
    currentUser = {
      id: "u1",
      username: "user",
      name: "User",
      phone: "1",
      avatar: null,
      role: "USER",
      status: "ACTIVE",
    };

    const res = await fetch(`${baseUrl}/admin/stats/overview`);
    expect(res.status).toBe(403);
  });

  it("allows admin to fetch overview stats", async () => {
    currentUser = {
      id: "a1",
      username: "admin",
      name: "Admin",
      phone: "1",
      avatar: null,
      role: "ADMIN",
      status: "ACTIVE",
    };

    const res = await fetch(`${baseUrl}/admin/stats/overview`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(adminServiceMock.getOverviewStats).toHaveBeenCalledTimes(1);
  });
});

