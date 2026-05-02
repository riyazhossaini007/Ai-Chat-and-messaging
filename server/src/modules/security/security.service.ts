import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { createHash, createHmac } from "crypto";

const logSecurityEvent = async (input: {
  userId?: string | null;
  type:
    | "ACCESS_DENIED"
    | "RATE_LIMIT_VIOLATION"
    | "PROMPT_INJECTION_ATTEMPT"
    | "DATA_EXFIL_ATTEMPT"
    | "AUDIT_CHAIN_FAILURE"
    | "SUSPICIOUS_ACTIVITY"
    | "PAYWALL_BLOCK"
    | "CIRCUIT_OPEN"
    | "PROVIDER_DOWN"
    | "BILLING_ANOMALY";
  route?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  details?: Record<string, unknown>;
}) => {
  try {
    await (prisma as any).securityEvent.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        route: input.route,
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
        details: input.details ? (input.details as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch {
    // best-effort logging
  }
};

const jsonStable = (value: unknown) => JSON.stringify(value ?? {});

const computeAuditHash = (input: {
  previousHash?: string | null;
  actorUserId: string;
  diff: unknown;
  requestId: string;
}) => {
  return createHash("sha256")
    .update(
      `${input.previousHash ?? ""}|${input.actorUserId}|${jsonStable(input.diff)}|${input.requestId}`
    )
    .digest("hex");
};

const computeAuditSignature = (hash: string) => {
  return createHmac("sha256", env.AUDIT_SIGNING_SECRET).update(hash).digest("hex");
};

const createConfigAuditLog = async (input: {
  actorUserId: string;
  action: "AI_CONFIG_UPDATE";
  before: unknown;
  after: unknown;
  diff: unknown;
  reason?: string | null;
  ip?: string;
  userAgent?: string;
  requestId: string;
  configVersion: number;
}) => {
  const previous = await (prisma as any).configAuditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const hash = computeAuditHash({
    previousHash: previous?.hash ?? null,
    actorUserId: input.actorUserId,
    diff: input.diff,
    requestId: input.requestId,
  });
  const signature = computeAuditSignature(hash);

  return (prisma as any).configAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      before: input.before as Prisma.InputJsonValue,
      after: input.after as Prisma.InputJsonValue,
      diff: input.diff as Prisma.InputJsonValue,
      reason: input.reason ?? null,
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
      configVersion: input.configVersion,
      signature,
      previousHash: previous?.hash ?? null,
      hash,
    },
  });
};

const verifyAuditChain = async () => {
  const rows = await (prisma as any).configAuditLog.findMany({
    orderBy: { createdAt: "asc" },
  });
  let previousHash: string | null = null;
  for (const row of rows) {
    const recomputedHash = computeAuditHash({
      previousHash,
      actorUserId: row.actorUserId,
      diff: row.diff,
      requestId: row.requestId,
    });
    const recomputedSig = computeAuditSignature(recomputedHash);

    if (row.previousHash !== previousHash || row.hash !== recomputedHash || row.signature !== recomputedSig) {
      return {
        ok: false,
        failedLogId: row.id as string,
      };
    }
    previousHash = row.hash as string;
  }
  return { ok: true, count: rows.length };
};

const computeAdminAuditHash = (input: {
  previousHash?: string | null;
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  requestId: string;
  after: unknown;
}) => {
  return createHash("sha256")
    .update(
      `${input.previousHash ?? ""}|${input.actorUserId}|${input.action}|${
        input.targetUserId ?? ""
      }|${jsonStable(input.after)}|${input.requestId}`
    )
    .digest("hex");
};

const createAdminActionAuditLog = async (input: {
  actorUserId: string;
  targetUserId?: string | null;
  action: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  requestId: string;
}) => {
  const previous = await (prisma as any).adminActionAuditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const hash = computeAdminAuditHash({
    previousHash: previous?.hash ?? null,
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    requestId: input.requestId,
    after: input.after ?? {},
  });
  const signature = computeAuditSignature(hash);

  return (prisma as any).adminActionAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      reason: input.reason ?? null,
      before: input.before ? (input.before as Prisma.InputJsonValue) : undefined,
      after: input.after ? (input.after as Prisma.InputJsonValue) : undefined,
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
      signature,
      previousHash: previous?.hash ?? null,
      hash,
    },
  });
};

const verifyAdminActionAuditChain = async () => {
  const rows = await (prisma as any).adminActionAuditLog.findMany({
    orderBy: { createdAt: "asc" },
  });
  let previousHash: string | null = null;
  for (const row of rows) {
    const recomputedHash = computeAdminAuditHash({
      previousHash,
      actorUserId: row.actorUserId,
      action: row.action,
      targetUserId: row.targetUserId,
      requestId: row.requestId,
      after: row.after ?? {},
    });
    const recomputedSig = computeAuditSignature(recomputedHash);
    if (
      row.previousHash !== previousHash ||
      row.hash !== recomputedHash ||
      row.signature !== recomputedSig
    ) {
      return {
        ok: false,
        failedLogId: row.id as string,
      };
    }
    previousHash = row.hash as string;
  }
  return { ok: true, count: rows.length };
};

export const securityService = {
  logSecurityEvent,
  createConfigAuditLog,
  verifyAuditChain,
  createAdminActionAuditLog,
  verifyAdminActionAuditChain,
};
