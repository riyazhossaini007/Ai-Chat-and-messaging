"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const prisma_1 = require("../config/prisma");
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("./errorHandler");
const ROLE_WEIGHT = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPERADMIN: 4,
};
const requireAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new errorHandler_1.AppError(401, "Unauthorized");
        }
        const token = authHeader.slice(7);
        const payload = (0, jwt_1.verifyToken)(token);
        const userId = payload.sub;
        if (!userId) {
            throw new errorHandler_1.AppError(401, "Unauthorized");
        }
        const user = await prisma_1.prisma.user.findUnique({
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
            throw new errorHandler_1.AppError(401, "Unauthorized");
        }
        if (user.status === "BANNED" || user.status === "DELETED") {
            throw new errorHandler_1.AppError(403, "Account is not active", { code: "account-inactive" });
        }
        const effectiveRole = user.userRoles.reduce((acc, item) => {
            const roleName = String(item.role.name);
            return (ROLE_WEIGHT[roleName] ?? 0) > (ROLE_WEIGHT[acc] ?? 0) ? roleName : acc;
        }, String(user.role));
        req.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            phone: user.phone,
            avatar: user.avatar,
            role: effectiveRole,
            status: user.status,
        };
        void prisma_1.prisma.user
            .update({
            where: { id: user.id },
            data: { lastActiveAt: new Date() },
        })
            .catch(() => undefined);
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireAuth = requireAuth;
