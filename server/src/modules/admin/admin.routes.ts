import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { adminRateLimit } from "../../middlewares/adminRateLimit";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { requireModeratorOrAdmin } from "../../middlewares/requireModeratorOrAdmin";
import {
  deleteAdminGroup,
  getAdminAiTopUsers,
  getAdminAiUsage,
  getAdminAuditLogs,
  getAdminCallDetail,
  getAdminCallStats,
  getAdminCalls,
  getAdminEntitlements,
  getAdminGroupDetail,
  getAdminGroups,
  getAdminHealth,
  getAdminOverviewStats,
  getAdminReportDetail,
  getAdminReports,
  getAdminUserDetail,
  getAdminUsers,
  patchAdminGroupFreeze,
  patchAdminReportStatus,
  patchAdminUserNote,
  patchAdminUserRole,
  patchAdminUserStatus,
  postAdminBanUser,
  postAdminGrantEntitlement,
  postAdminRemoveMessage,
  postAdminRevokeEntitlement,
} from "./admin.controller";

const adminRouter = Router();

adminRouter.use(requireAuth, adminRateLimit);

adminRouter.get("/stats/overview", requireModeratorOrAdmin, getAdminOverviewStats);

adminRouter.get("/entitlements", requireModeratorOrAdmin, getAdminEntitlements);
adminRouter.post("/entitlements/grant", requireAdmin, postAdminGrantEntitlement);
adminRouter.post("/entitlements/revoke", requireAdmin, postAdminRevokeEntitlement);

adminRouter.get("/users", requireModeratorOrAdmin, getAdminUsers);
adminRouter.get("/users/:id", requireModeratorOrAdmin, getAdminUserDetail);
adminRouter.patch("/users/:id/role", requireAdmin, patchAdminUserRole);
adminRouter.patch("/users/:id/status", requireModeratorOrAdmin, patchAdminUserStatus);
adminRouter.patch("/users/:id/note", requireModeratorOrAdmin, patchAdminUserNote);

adminRouter.get("/ai/usage", requireModeratorOrAdmin, getAdminAiUsage);
adminRouter.get("/ai/users/top", requireModeratorOrAdmin, getAdminAiTopUsers);

adminRouter.get("/reports", requireModeratorOrAdmin, getAdminReports);
adminRouter.get("/reports/:id", requireModeratorOrAdmin, getAdminReportDetail);
adminRouter.patch("/reports/:id/status", requireModeratorOrAdmin, patchAdminReportStatus);
adminRouter.post("/moderation/ban-user", requireModeratorOrAdmin, postAdminBanUser);
adminRouter.post("/moderation/remove-message", requireModeratorOrAdmin, postAdminRemoveMessage);

adminRouter.get("/groups", requireModeratorOrAdmin, getAdminGroups);
adminRouter.get("/groups/:id", requireModeratorOrAdmin, getAdminGroupDetail);
adminRouter.patch("/groups/:id/freeze", requireModeratorOrAdmin, patchAdminGroupFreeze);
adminRouter.delete("/groups/:id", requireAdmin, deleteAdminGroup);

adminRouter.get("/calls", requireModeratorOrAdmin, getAdminCalls);
adminRouter.get("/calls/stats", requireModeratorOrAdmin, getAdminCallStats);
adminRouter.get("/calls/:id", requireModeratorOrAdmin, getAdminCallDetail);
adminRouter.get("/audit-logs", requireModeratorOrAdmin, getAdminAuditLogs);

adminRouter.get("/health", requireAdmin, getAdminHealth);

export { adminRouter };
