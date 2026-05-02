import { NextFunction, Response } from "express";
import { prisma } from "../config/prisma";
import { verifyToken } from "../utils/jwt";
import { AppError } from "./errorHandler";
import { AuthRequest } from "../types";

const ROLE_WEIGHT: Record<string, number> = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
};

export const requireAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "Unauthorized");
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    const userId = payload.sub;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        userRoles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(401, "Unauthorized");
    }

    if (user.status === "BANNED" || user.status === "DELETED") {
      throw new AppError(403, "Account is not active", { code: "account-inactive" });
    }

    const effectiveRole = user.userRoles.reduce((acc, item) => {
      const roleName = String(item.role.name);
      return (ROLE_WEIGHT[roleName] ?? 0) > (ROLE_WEIGHT[acc] ?? 0) ? roleName : acc;
    }, String(user.role)) as "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: effectiveRole,
      status: user.status as "ACTIVE" | "BANNED" | "DELETED",
    };
    void prisma.user
      .update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => undefined);
    next();
  } catch (error) {
    next(error);
  }
};
