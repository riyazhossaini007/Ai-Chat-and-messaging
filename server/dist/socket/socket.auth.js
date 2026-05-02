"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = void 0;
const prisma_1 = require("../config/prisma");
const jwt_1 = require("../utils/jwt");
const extractToken = (socket) => {
    const handshakeToken = socket.handshake.auth?.token;
    if (typeof handshakeToken === "string" && handshakeToken.trim()) {
        return handshakeToken.trim();
    }
    const authHeader = socket.handshake.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim();
    }
    return null;
};
const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = extractToken(socket);
        if (!token) {
            next(new Error("Unauthorized"));
            return;
        }
        const payload = (0, jwt_1.verifyToken)(token);
        const userId = typeof payload.sub === "string" ? payload.sub : undefined;
        if (!userId) {
            next(new Error("Unauthorized"));
            return;
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
            },
        });
        if (!user) {
            next(new Error("Unauthorized"));
            return;
        }
        if (!user || user.status !== "ACTIVE") {
            next(new Error("Unauthorized"));
            return;
        }
        socket.data.user = user;
        next();
    }
    catch {
        next(new Error("Unauthorized"));
    }
};
exports.socketAuthMiddleware = socketAuthMiddleware;
