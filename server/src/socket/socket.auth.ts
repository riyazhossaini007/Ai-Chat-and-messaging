import { prisma } from "../config/prisma";
import { verifyToken } from "../utils/jwt";
import type { AuthenticatedSocket } from "./types";

const extractToken = (socket: AuthenticatedSocket) => {
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

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    const token = extractToken(socket);
    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    const payload = verifyToken(token);
    const userId = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!userId) {
      next(new Error("Unauthorized"));
      return;
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
  } catch {
    next(new Error("Unauthorized"));
  }
};
