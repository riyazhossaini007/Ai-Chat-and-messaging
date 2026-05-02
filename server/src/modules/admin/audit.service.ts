import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../config/prisma";

type LogActionInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
  req?: Request;
};

const logAction = async (input: LogActionInput) => {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      meta: (input.meta as Prisma.InputJsonValue | undefined) ?? undefined,
      ip: input.req?.ip ?? null,
      userAgent: typeof input.req?.headers["user-agent"] === "string" ? input.req.headers["user-agent"] : null,
    },
  });
};

export const auditService = {
  logAction,
};
