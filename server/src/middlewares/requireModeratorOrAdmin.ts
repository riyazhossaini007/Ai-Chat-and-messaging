import { requireRole } from "./requireRole";

export const requireModeratorOrAdmin = requireRole("MODERATOR", "ADMIN");

