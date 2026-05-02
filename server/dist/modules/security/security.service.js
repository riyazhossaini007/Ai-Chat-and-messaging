"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityService = void 0;
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const crypto_1 = require("crypto");
const logSecurityEvent = async (input) => {
    try {
        await prisma_1.prisma.securityEvent.create({
            data: {
                userId: input.userId ?? null,
                type: input.type,
                route: input.route,
                ip: input.ip,
                userAgent: input.userAgent,
                requestId: input.requestId,
                details: input.details ? input.details : undefined,
            },
        });
    }
    catch {
        // best-effort logging
    }
};
const jsonStable = (value) => JSON.stringify(value ?? {});
const computeAuditHash = (input) => {
    return (0, crypto_1.createHash)("sha256")
        .update(`${input.previousHash ?? ""}|${input.actorUserId}|${jsonStable(input.diff)}|${input.requestId}`)
        .digest("hex");
};
const computeAuditSignature = (hash) => {
    return (0, crypto_1.createHmac)("sha256", env_1.env.AUDIT_SIGNING_SECRET).update(hash).digest("hex");
};
const createConfigAuditLog = async (input) => {
    const previous = await prisma_1.prisma.configAuditLog.findFirst({
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
    return prisma_1.prisma.configAuditLog.create({
        data: {
            actorUserId: input.actorUserId,
            action: input.action,
            before: input.before,
            after: input.after,
            diff: input.diff,
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
    const rows = await prisma_1.prisma.configAuditLog.findMany({
        orderBy: { createdAt: "asc" },
    });
    let previousHash = null;
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
                failedLogId: row.id,
            };
        }
        previousHash = row.hash;
    }
    return { ok: true, count: rows.length };
};
const computeAdminAuditHash = (input) => {
    return (0, crypto_1.createHash)("sha256")
        .update(`${input.previousHash ?? ""}|${input.actorUserId}|${input.action}|${input.targetUserId ?? ""}|${jsonStable(input.after)}|${input.requestId}`)
        .digest("hex");
};
const createAdminActionAuditLog = async (input) => {
    const previous = await prisma_1.prisma.adminActionAuditLog.findFirst({
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
    return prisma_1.prisma.adminActionAuditLog.create({
        data: {
            actorUserId: input.actorUserId,
            targetUserId: input.targetUserId ?? null,
            action: input.action,
            reason: input.reason ?? null,
            before: input.before ? input.before : undefined,
            after: input.after ? input.after : undefined,
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
    const rows = await prisma_1.prisma.adminActionAuditLog.findMany({
        orderBy: { createdAt: "asc" },
    });
    let previousHash = null;
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
        if (row.previousHash !== previousHash ||
            row.hash !== recomputedHash ||
            row.signature !== recomputedSig) {
            return {
                ok: false,
                failedLogId: row.id,
            };
        }
        previousHash = row.hash;
    }
    return { ok: true, count: rows.length };
};
exports.securityService = {
    logSecurityEvent,
    createConfigAuditLog,
    verifyAuditChain,
    createAdminActionAuditLog,
    verifyAdminActionAuditChain,
};
