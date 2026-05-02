import type { EntitlementFeatureKey } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { auditService } from "./audit.service";
import { featureGateService } from "./featureGate.service";
import { rbacService } from "../security/rbac.service";

const prismaAny = prisma as any;
const DAY_MS = 86_400_000;

const startOfDayUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const dayKey = (d: Date) => startOfDayUtc(d).toISOString().slice(0, 10);

const buildDaySeries = (from: Date, to: Date, counts: Map<string, number>) => {
  const out: Array<{ day: string; count: number }> = [];
  let cursor = startOfDayUtc(from).getTime();
  const end = startOfDayUtc(to).getTime();
  while (cursor <= end) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    out.push({ day: key, count: counts.get(key) ?? 0 });
    cursor += DAY_MS;
  }
  return out;
};

const getCurrentPlanForUser = async (userId: string) => {
  const [subscription, userSubscription] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      orderBy: { currentPeriodEnd: "desc" },
      include: { plan: true },
    }),
    prisma.userSubscription.findFirst({
      where: { userId, status: "active", validUntil: { gt: new Date() } },
      orderBy: { validUntil: "desc" },
    }),
  ]);

  if (subscription) {
    return { plan: subscription.plan.name, proUntil: subscription.currentPeriodEnd };
  }
  if (userSubscription) {
    return { plan: userSubscription.plan, proUntil: userSubscription.validUntil };
  }
  return { plan: "FREE", proUntil: null as Date | null };
};

const listEntitlements = async (userId: string) => {
  return prismaAny.entitlementGrant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

const grantEntitlement = async (input: {
  actorUserId: string;
  userId: string;
  featureKey: EntitlementFeatureKey;
  expiresAt?: Date;
  reason?: string;
  reqMeta?: { ip?: string; userAgent?: string; req?: any };
}) => {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AppError(404, "User not found");
  const row = await prismaAny.entitlementGrant.create({
    data: {
      userId: input.userId,
      featureKey: input.featureKey,
      expiresAt: input.expiresAt ?? null,
      grantedByUserId: input.actorUserId,
      reason: input.reason ?? null,
    },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.entitlement.grant",
    targetType: "ENTITLEMENT",
    targetId: row.id,
    meta: {
      userId: input.userId,
      featureKey: input.featureKey,
      expiresAt: input.expiresAt?.toISOString() ?? null,
      reason: input.reason ?? null,
    },
    req: input.reqMeta?.req,
  });
  return row;
};

const revokeEntitlement = async (input: {
  actorUserId: string;
  entitlementId: string;
  reason?: string;
  req?: any;
}) => {
  const row = await prismaAny.entitlementGrant.findUnique({ where: { id: input.entitlementId } });
  if (!row) throw new AppError(404, "Entitlement not found");
  const updated = await prismaAny.entitlementGrant.update({
    where: { id: input.entitlementId },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedByUserId: input.actorUserId,
      reason: input.reason ? `${row.reason ?? ""}${row.reason ? " | " : ""}revoke:${input.reason}` : row.reason,
    },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.entitlement.revoke",
    targetType: "ENTITLEMENT",
    targetId: input.entitlementId,
    meta: { reason: input.reason ?? null },
    req: input.req,
  });
  return updated;
};

const getOverviewStats = async (range: { from: Date; to: Date }) => {
  const from = range.from;
  const to = range.to;
  const dauStart = new Date(to.getTime() - 1 * DAY_MS);
  const wauStart = new Date(to.getTime() - 7 * DAY_MS);

  const [
    totalUsers,
    newUsersRows,
    newUsers,
    dau,
    wau,
    messages,
    aiLogs,
    aiUsers,
    callRows,
    paidUsersViaSubs,
    paidUsersViaUserSubs,
    complimentaryUsers,
    reportsOpen,
    reportsResolved,
    bansActive,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: "DELETED" } as any } }),
    prisma.user.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: dauStart, lte: to } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: wauStart, lte: to } } }),
    prisma.message.findMany({
      where: { createdAt: { gte: from, lte: to }, kind: "USER" },
      select: { createdAt: true },
    }),
    prisma.aiRequestLog.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        userId: true,
        createdAt: true,
        provider: true,
        promptTokens: true,
        completionTokens: true,
        costUsd: true,
      },
    }),
    prisma.aiRequestLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: from, lte: to }, status: "OK" },
      _count: { _all: true },
    }),
    prismaAny.callSession.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        status: true,
        createdAt: true,
        startedAt: true,
        connectedAt: true,
        endedAt: true,
        durationSec: true,
        failureReason: true,
      },
    }),
    prisma.subscription.groupBy({
      by: ["userId"],
      where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      _count: { _all: true },
    }),
    prisma.userSubscription.groupBy({
      by: ["userId"],
      where: { status: "active", validUntil: { gt: new Date() } },
      _count: { _all: true },
    }),
    prismaAny.entitlementGrant.groupBy({
      by: ["userId"],
      where: {
        featureKey: "PRO_ACCESS",
        isRevoked: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      _count: { _all: true },
    }),
    prismaAny.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prismaAny.report.count({ where: { status: "RESOLVED" } }),
    prisma.user.count({ where: { status: "BANNED" as any } }),
  ]);

  const userCounts = new Map<string, number>();
  newUsersRows.forEach((r) => userCounts.set(dayKey(r.createdAt), (userCounts.get(dayKey(r.createdAt)) ?? 0) + 1));
  const messageCounts = new Map<string, number>();
  messages.forEach((r) => messageCounts.set(dayKey(r.createdAt), (messageCounts.get(dayKey(r.createdAt)) ?? 0) + 1));
  const aiCounts = new Map<string, number>();
  const callCounts = new Map<string, number>();
  const failureReasonMap = new Map<string, number>();
  let aiRequests = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let estimatedCostUsd = 0;
  const modelBreakdown = { OPENAI: 0, OPENROUTER: 0 } as Record<string, number>;
  aiLogs.forEach((row) => {
    aiRequests += 1;
    tokensIn += row.promptTokens ?? 0;
    tokensOut += row.completionTokens ?? 0;
    estimatedCostUsd += row.costUsd ?? 0;
    const provider = String(row.provider || "").toUpperCase();
    if (provider.includes("OPENROUTER")) modelBreakdown.OPENROUTER += 1;
    else modelBreakdown.OPENAI += 1;
    aiCounts.set(dayKey(row.createdAt), (aiCounts.get(dayKey(row.createdAt)) ?? 0) + 1);
  });

  let totalCalls = 0;
  let successfulCalls = 0;
  let failedCalls = 0;
  let droppedCalls = 0;
  let durationSum = 0;
  let durationCount = 0;
  callRows.forEach((row: any) => {
    totalCalls += 1;
    callCounts.set(dayKey(new Date(row.createdAt)), (callCounts.get(dayKey(new Date(row.createdAt))) ?? 0) + 1);
    const status = String(row.status ?? "").toLowerCase();
    if (["ended", "accepted", "in_progress"].includes(status)) successfulCalls += 1;
    if (["failed", "declined", "busy", "timeout", "missed"].includes(status)) failedCalls += 1;
    if (status === "failed" && String(row.failureReason ?? "").toLowerCase().includes("drop")) droppedCalls += 1;
    if (status === "failed" && row.failureReason) {
      const key = String(row.failureReason);
      failureReasonMap.set(key, (failureReasonMap.get(key) ?? 0) + 1);
    }
    const dur = Number(row.durationSec ?? 0);
    const computedDur =
      dur > 0
        ? dur
        : row.endedAt && (row.connectedAt || row.startedAt)
        ? Math.max(0, Math.floor((new Date(row.endedAt).getTime() - new Date(row.connectedAt ?? row.startedAt).getTime()) / 1000))
        : 0;
    if (computedDur > 0) {
      durationSum += computedDur;
      durationCount += 1;
    }
  });

  const paidUserIds = new Set<string>([
    ...paidUsersViaSubs.map((r) => r.userId),
    ...paidUsersViaUserSubs.map((r: any) => r.userId),
  ]);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    users: {
      totalUsers,
      newUsers,
      newUsersByDay: buildDaySeries(from, to, userCounts),
    },
    activity: {
      dau,
      wau,
      messagesSent: messages.length,
      messagesByDay: buildDaySeries(from, to, messageCounts),
    },
    ai: {
      aiRequests,
      aiUsers: aiUsers.length,
      aiByDay: buildDaySeries(from, to, aiCounts),
      modelBreakdown,
      tokensIn,
      tokensOut,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    },
    calls: {
      totalCalls,
      successfulCalls,
      failedCalls,
      droppedCalls,
      avgDurationSec: durationCount ? Math.round(durationSum / durationCount) : 0,
      successRate: totalCalls ? Number((successfulCalls / totalCalls).toFixed(4)) : 0,
      callsByDay: buildDaySeries(from, to, callCounts),
      failureReasons: Array.from(failureReasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    },
    billing: {
      paidUsers: paidUserIds.size,
      complimentaryUsers: complimentaryUsers.length,
      trialUsers: 0,
    },
    moderation: {
      reportsOpen,
      reportsResolved,
      bansActive,
    },
  };
};

const listUsers = async (query: Record<string, unknown>) => {
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const role = typeof query.role === "string" ? query.role.trim() : undefined;
  const status = typeof query.status === "string" ? query.status.trim() : undefined;
  const createdFrom = query.createdFrom ? new Date(String(query.createdFrom)) : undefined;
  const createdTo = query.createdTo ? new Date(String(query.createdTo)) : undefined;
  const lastActiveFrom = query.lastActiveFrom ? new Date(String(query.lastActiveFrom)) : undefined;
  const lastActiveTo = query.lastActiveTo ? new Date(String(query.lastActiveTo)) : undefined;
  const limit = Math.max(1, Math.min(Number(query.limit ?? 20) || 20, 100));
  const cursor = typeof query.cursor === "string" && query.cursor ? query.cursor : undefined;

  const rows = await prisma.user.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(role ? { role: role as any } : {}),
      ...(status ? { status: status as any } : {}),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom ? { gte: createdFrom } : {}),
              ...(createdTo ? { lte: createdTo } : {}),
            },
          }
        : {}),
      ...(lastActiveFrom || lastActiveTo
        ? {
            lastActiveAt: {
              ...(lastActiveFrom ? { gte: lastActiveFrom } : {}),
              ...(lastActiveTo ? { lte: lastActiveTo } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;

  const enriched = await Promise.all(
    items.map(async (row) => {
      const activeProEntitlement = await prismaAny.entitlementGrant.findFirst({
        where: {
          userId: row.id,
          featureKey: "PRO_ACCESS",
          isRevoked: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
        select: { expiresAt: true },
      });
      const planInfo = await getCurrentPlanForUser(row.id);
      return {
        ...row,
        plan: planInfo.plan,
        proUntil: planInfo.proUntil?.toISOString() ?? activeProEntitlement?.expiresAt?.toISOString() ?? null,
      };
    })
  );

  const planFilter = typeof query.plan === "string" ? String(query.plan).trim().toLowerCase() : "";
  const filteredEnriched = planFilter
    ? enriched.filter((row) => String(row.plan).toLowerCase() === planFilter)
    : enriched;

  return {
    items: filteredEnriched,
    nextCursor: hasNext ? items[items.length - 1]?.id ?? null : null,
  };
};

const getUserDetail = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      adminNote: true,
      createdAt: true,
      updatedAt: true,
      lastActiveAt: true,
      isVerified: true,
    },
  });
  if (!user) throw new AppError(404, "User not found");

  const [entitlements, messagesSent, aiRequests, calls] = await Promise.all([
    prismaAny.entitlementGrant.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.count({
      where: { senderId: id, kind: "USER", createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
    }),
    prisma.aiRequestLog.count({
      where: { userId: id, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
    }),
    prismaAny.callParticipant.count({
      where: { userId: id, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
    }),
  ]);

  const planInfo = await getCurrentPlanForUser(id);

  return {
    ...user,
    plan: planInfo.plan,
    proUntil: planInfo.proUntil?.toISOString() ?? null,
    entitlements,
    usageSummary7d: { messagesSent, aiRequests, calls },
  };
};

const patchUserRole = async (input: { actorUserId: string; userId: string; role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN"; req?: any }) => {
  await rbacService.ensureRbacBootstrap();
  const existingRoles = await rbacService.getUserRoles(input.userId).catch(() => [] as Array<"USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN">);
  await Promise.all(existingRoles.filter((r) => r !== input.role).map((r) => rbacService.revokeRole({ userId: input.userId, role: r })));
  await rbacService.assignRole({ userId: input.userId, role: input.role });
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { role: input.role as any },
    select: { id: true, role: true },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.user.role.update",
    targetType: "USER",
    targetId: input.userId,
    meta: { role: input.role },
    req: input.req,
  });
  return updated;
};

const patchUserStatus = async (input: {
  actorUserId: string;
  userId: string;
  status: "ACTIVE" | "BANNED" | "DELETED";
  reason?: string;
  req?: any;
}) => {
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { status: input.status as any, adminNote: input.reason ? input.reason.slice(0, 1000) : undefined },
    select: { id: true, status: true, adminNote: true },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.user.status.update",
    targetType: "USER",
    targetId: input.userId,
    meta: { status: input.status, reason: input.reason ?? null },
    req: input.req,
  });
  return updated;
};

const patchUserNote = async (input: { actorUserId: string; userId: string; note: string | null; req?: any }) => {
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { adminNote: input.note },
    select: { id: true, adminNote: true },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.user.note.update",
    targetType: "USER",
    targetId: input.userId,
    meta: { note: input.note },
    req: input.req,
  });
  return updated;
};

const listAiUsage = async (filters: { from: Date; to: Date; userId?: string; provider?: string; status?: string }) => {
  const aiUsageRows =
    (await prismaAny.aiUsageEvent
      ?.findMany?.({
        where: {
          createdAt: { gte: filters.from, lte: filters.to },
          ...(filters.userId ? { userId: filters.userId } : {}),
          ...(filters.provider ? { modelProvider: String(filters.provider).toUpperCase() } : {}),
          ...(filters.status ? { status: String(filters.status).toUpperCase() } : {}),
        },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => [])) ?? [];
  const rows =
    aiUsageRows.length > 0
      ? aiUsageRows.map((r: any) => ({
          userId: r.userId,
          createdAt: r.createdAt,
          provider: r.modelProvider,
          model: r.modelName,
          promptTokens: r.tokensIn ?? 0,
          completionTokens: r.tokensOut ?? 0,
          totalTokens: (r.tokensIn ?? 0) + (r.tokensOut ?? 0),
          costUsd: r.costUsd ?? 0,
          status: r.status,
          errorCode: r.errorCode,
        }))
      : await prisma.aiRequestLog.findMany({
          where: {
            createdAt: { gte: filters.from, lte: filters.to },
            ...(filters.userId ? { userId: filters.userId } : {}),
            ...(filters.provider ? { provider: { contains: filters.provider, mode: "insensitive" as const } } : {}),
            ...(filters.status ? { status: filters.status as any } : {}),
          },
          select: {
            userId: true,
            createdAt: true,
            provider: true,
            model: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
            status: true,
            errorCode: true,
          },
          orderBy: { createdAt: "desc" },
        });

  const byDay = new Map<string, number>();
  const byUserReq = new Map<string, { requests: number; tokens: number }>();
  let totalRequests = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCost = 0;
  rows.forEach((row: any) => {
    totalRequests += 1;
    totalTokensIn += row.promptTokens;
    totalTokensOut += row.completionTokens;
    totalCost += row.costUsd;
    byDay.set(dayKey(row.createdAt), (byDay.get(dayKey(row.createdAt)) ?? 0) + 1);
    const entry = byUserReq.get(row.userId) ?? { requests: 0, tokens: 0 };
    entry.requests += 1;
    entry.tokens += row.totalTokens;
    byUserReq.set(row.userId, entry);
  });

  const topUserIds = Array.from(byUserReq.entries())
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, 10)
    .map(([userId]) => userId);
  const topUsers = topUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: topUserIds } }, select: { id: true, username: true, name: true } })
    : [];
  const topUsersMap = new Map(topUsers.map((u) => [u.id, u]));

  return {
    totals: {
      requests: totalRequests,
      aiUsers: byUserReq.size,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      totalCostUsd: Number(totalCost.toFixed(6)),
    },
    trendByDay: buildDaySeries(filters.from, filters.to, byDay),
    topUsers: Array.from(byUserReq.entries())
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, 10)
      .map(([userId, metrics]) => ({
        userId,
        username: topUsersMap.get(userId)?.username ?? null,
        name: topUsersMap.get(userId)?.name ?? null,
        requests: metrics.requests,
        tokens: metrics.tokens,
      })),
  };
};

const getTopAiUsers = async (input: { from: Date; to: Date; metric: "requests" | "tokens" }) => {
  const aiUsageRows =
    (await prismaAny.aiUsageEvent
      ?.findMany?.({
        where: { createdAt: { gte: input.from, lte: input.to } },
        select: { userId: true, tokensIn: true, tokensOut: true },
      })
      .catch(() => [])) ?? [];
  const rows =
    aiUsageRows.length > 0
      ? aiUsageRows.map((r: any) => ({ userId: r.userId, totalTokens: (r.tokensIn ?? 0) + (r.tokensOut ?? 0) }))
      : await prisma.aiRequestLog.findMany({
          where: { createdAt: { gte: input.from, lte: input.to } },
          select: { userId: true, totalTokens: true },
        });
  const map = new Map<string, { requests: number; tokens: number }>();
  rows.forEach((r: any) => {
    const cur = map.get(r.userId) ?? { requests: 0, tokens: 0 };
    cur.requests += 1;
    cur.tokens += r.totalTokens ?? 0;
    map.set(r.userId, cur);
  });
  const sorted = Array.from(map.entries()).sort((a, b) =>
    input.metric === "requests" ? b[1].requests - a[1].requests : b[1].tokens - a[1].tokens
  );
  const ids = sorted.slice(0, 20).map(([id]) => id);
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, name: true } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return sorted.slice(0, 20).map(([userId, metrics]) => ({
    userId,
    username: userMap.get(userId)?.username ?? null,
    name: userMap.get(userId)?.name ?? null,
    requests: metrics.requests,
    tokens: metrics.tokens,
  }));
};

const listReports = async (query: Record<string, unknown>) => {
  const rows = await prismaAny.report.findMany({
    where: {
      ...(query.status ? { status: String(query.status) } : {}),
      ...(query.targetType ? { targetType: String(query.targetType) } : {}),
      ...(query.q
        ? {
            OR: [
              { targetId: { contains: String(query.q), mode: "insensitive" } },
              { reasonCode: { contains: String(query.q), mode: "insensitive" } },
              { description: { contains: String(query.q), mode: "insensitive" } },
            ],
          }
        : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(String(query.from)) } : {}),
              ...(query.to ? { lte: new Date(String(query.to)) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows;
};

const getReport = async (id: string) => {
  const row = await prismaAny.report.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "Report not found");
  return row;
};

const patchReportStatus = async (input: {
  actorUserId: string;
  id: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionNote?: string;
  req?: any;
}) => {
  const updated = await prismaAny.report.update({
    where: { id: input.id },
    data: {
      status: input.status,
      resolutionNote: input.resolutionNote ?? undefined,
      resolvedAt: input.status === "RESOLVED" || input.status === "REJECTED" ? new Date() : null,
      resolvedByUserId: input.status === "RESOLVED" || input.status === "REJECTED" ? input.actorUserId : null,
    },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.report.status.update",
    targetType: "REPORT",
    targetId: input.id,
    meta: { status: input.status, resolutionNote: input.resolutionNote ?? null },
    req: input.req,
  });
  return updated;
};

const moderationBanUser = async (input: { actorUserId: string; userId: string; reason: string; req?: any }) => {
  const updated = await patchUserStatus({
    actorUserId: input.actorUserId,
    userId: input.userId,
    status: "BANNED",
    reason: input.reason,
    req: input.req,
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.moderation.ban-user",
    targetType: "USER",
    targetId: input.userId,
    meta: { reason: input.reason },
    req: input.req,
  });
  return updated;
};

const moderationRemoveMessage = async (input: { actorUserId: string; messageId: string; reason: string; req?: any }) => {
  const message = await prisma.message.findUnique({ where: { id: input.messageId }, select: { id: true } });
  if (!message) throw new AppError(404, "Message not found");
  const updated = await prisma.message.update({
    where: { id: input.messageId },
    data: {
      deletedForEveryone: true,
      deletedAt: new Date(),
      deletedById: input.actorUserId,
      content: null,
      text: null,
      cipherText: null,
      mediaUrl: null,
    },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.moderation.remove-message",
    targetType: "MESSAGE",
    targetId: input.messageId,
    meta: { reason: input.reason },
    req: input.req,
  });
  return updated;
};

const listGroups = async (query: Record<string, unknown>) => {
  const rows = await prisma.group.findMany({
    where: {
      ...(query.q
        ? {
            OR: [
              { title: { contains: String(query.q), mode: "insensitive" } },
              { name: { contains: String(query.q), mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.status ? { status: String(query.status) as any } : {}),
      ...((query.createdFrom || query.createdTo)
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(String(query.createdFrom)) } : {}),
              ...(query.createdTo ? { lte: new Date(String(query.createdTo)) } : {}),
            },
          }
        : {}),
    },
    include: {
      _count: { select: { members: true, messages: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const minMembers = query.memberCountMin ? Number(query.memberCountMin) : undefined;
  return rows
    .filter((g: any) => (Number.isFinite(minMembers) ? g._count.members >= Number(minMembers) : true))
    .map((g: any) => ({
      id: g.id,
      title: g.title,
      name: g.name,
      status: (g as any).status ?? "ACTIVE",
      createdAt: g.createdAt,
      memberCount: g._count.members,
      messageCount: g._count.messages,
      chatId: g.chatId,
      creatorId: g.creatorId,
    }));
};

const getGroupDetail = async (id: string) => {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        where: { leftAt: null },
        select: { userId: true, role: true, joinedAt: true, user: { select: { username: true, name: true } } },
      },
      _count: { select: { members: true, messages: true } },
    },
  });
  if (!group) throw new AppError(404, "Group not found");
  const recentActivityMessages = await prisma.message.count({
    where: { groupId: id, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
  });
  return {
    ...group,
    recentActivity: { messages7d: recentActivityMessages },
    admins: group.members.filter((m) => m.role === "ADMIN" || m.role === "CREATOR"),
  };
};

const freezeGroup = async (input: { actorUserId: string; groupId: string; freeze: boolean; reason?: string; req?: any }) => {
  const updated = await prisma.group.update({
    where: { id: input.groupId },
    data: { status: (input.freeze ? "FROZEN" : "ACTIVE") as any },
    select: { id: true, status: true },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.group.freeze",
    targetType: "GROUP",
    targetId: input.groupId,
    meta: { freeze: input.freeze, reason: input.reason ?? null },
    req: input.req,
  });
  return updated;
};

const softDeleteGroup = async (input: { actorUserId: string; groupId: string; req?: any }) => {
  const updated = await prisma.group.update({
    where: { id: input.groupId },
    data: { status: "DELETED" as any },
    select: { id: true, status: true },
  });
  await auditService.logAction({
    actorUserId: input.actorUserId,
    action: "admin.group.delete",
    targetType: "GROUP",
    targetId: input.groupId,
    req: input.req,
  });
  return updated;
};

const listCalls = async (query: Record<string, unknown>) => {
  const limit = Math.max(1, Math.min(Number(query.limit ?? 20) || 20, 100));
  const where: any = {
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(String(query.from)) } : {}),
            ...(query.to ? { lte: new Date(String(query.to)) } : {}),
          },
        }
      : {}),
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.type ? { type: String(query.type) } : {}),
    ...(query.path
      ? String(query.path).toUpperCase() === "SFU"
        ? { sfuProvider: { not: "NONE" } }
        : { sfuProvider: "NONE" }
      : {}),
    ...(query.mode ? { type: String(query.mode).toUpperCase() === "AUDIO" ? "VOICE" : "VIDEO" } : {}),
  };
  const rows = await prismaAny.callSession.findMany({
    where,
    include: {
      participants: { select: { userId: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const durationMin = query.durationMin ? Number(query.durationMin) : 0;

  const filtered = rows.filter((row: any) => {
    const dur =
      Number(row.durationSec ?? 0) ||
      (row.endedAt && (row.connectedAt ?? row.startedAt)
        ? Math.floor((new Date(row.endedAt).getTime() - new Date(row.connectedAt ?? row.startedAt).getTime()) / 1000)
        : 0);
    if (durationMin && dur < durationMin) return false;
    if (!q) return true;
    const hay = [row.id, row.chatId, row.createdBy, row.hostUserId, ...row.participants.map((p: any) => p.userId)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return filtered.map((row: any) => ({
    ...row,
    participantsCount: row.participants.length,
  }));
};

const getCallDetail = async (id: string) => {
  const row = await prismaAny.callSession.findUnique({
    where: { id },
    include: {
      participants: true,
      events: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!row) throw new AppError(404, "Call not found");
  return row;
};

const getCallStats = async (range: { from: Date; to: Date }) => {
  const rows = await prismaAny.callSession.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    select: { status: true, createdAt: true, startedAt: true, connectedAt: true, endedAt: true, durationSec: true, meta: true, failureReason: true },
  });
  const trend = new Map<string, number>();
  const failures = new Map<string, number>();
  let totalCalls = 0;
  let successCalls = 0;
  let dropped = 0;
  let totalDur = 0;
  let durN = 0;
  let turnUsed = 0;
  rows.forEach((r: any) => {
    totalCalls += 1;
    trend.set(dayKey(new Date(r.createdAt)), (trend.get(dayKey(new Date(r.createdAt))) ?? 0) + 1);
    const status = String(r.status || "");
    if (["ended", "in_progress", "accepted"].includes(status)) successCalls += 1;
    if (status === "failed" && r.failureReason) failures.set(String(r.failureReason), (failures.get(String(r.failureReason)) ?? 0) + 1);
    if (status === "failed" && String(r.failureReason ?? "").toLowerCase().includes("drop")) dropped += 1;
    const dur =
      Number(r.durationSec ?? 0) ||
      (r.endedAt && (r.connectedAt ?? r.startedAt)
        ? Math.floor((new Date(r.endedAt).getTime() - new Date(r.connectedAt ?? r.startedAt).getTime()) / 1000)
        : 0);
    if (dur > 0) {
      totalDur += dur;
      durN += 1;
    }
    if ((r.meta as any)?.turnUsed) turnUsed += 1;
  });
  return {
    totalCalls,
    successRate: totalCalls ? Number((successCalls / totalCalls).toFixed(4)) : 0,
    avgDurationSec: durN ? Math.round(totalDur / durN) : 0,
    droppedRate: totalCalls ? Number((dropped / totalCalls).toFixed(4)) : 0,
    trendByDay: buildDaySeries(range.from, range.to, trend),
    failureReasonsBreakdown: Array.from(failures.entries()).map(([reason, count]) => ({ reason, count })),
    turnRelayRate: totalCalls ? Number((turnUsed / totalCalls).toFixed(4)) : 0,
  };
};

const getHealth = async () => {
  const result = {
    db: "skip",
    redis: "skip",
    livekit: "skip",
  } as { db: string; redis: string; livekit: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    result.db = "ok";
  } catch {
    result.db = "error";
  }
  return result;
};

const listAuditLogs = async (query: Record<string, unknown>) => {
  const limit = Math.max(1, Math.min(Number(query.limit ?? 100) || 100, 200));
  return prisma.auditLog.findMany({
    where: {
      ...(query.action ? { action: { contains: String(query.action), mode: "insensitive" } } : {}),
      ...(query.targetType ? { targetType: String(query.targetType) } : {}),
      ...(query.actorUserId ? { actorUserId: String(query.actorUserId) } : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(String(query.from)) } : {}),
              ...(query.to ? { lte: new Date(String(query.to)) } : {}),
            },
          }
        : {}),
    },
    include: {
      actor: { select: { id: true, username: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

export const adminService = {
  listEntitlements,
  grantEntitlement,
  revokeEntitlement,
  getOverviewStats,
  listUsers,
  getUserDetail,
  patchUserRole,
  patchUserStatus,
  patchUserNote,
  listAiUsage,
  getTopAiUsers,
  listReports,
  getReport,
  patchReportStatus,
  moderationBanUser,
  moderationRemoveMessage,
  listGroups,
  getGroupDetail,
  freezeGroup,
  softDeleteGroup,
  listCalls,
  getCallDetail,
  getCallStats,
  listAuditLogs,
  getHealth,
  featureGateService,
};
