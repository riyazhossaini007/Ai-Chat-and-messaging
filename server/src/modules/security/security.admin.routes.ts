import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requirePermission } from "../../middlewares/requirePermission";
import { requireSuperadminStepUp } from "../../middlewares/requireSuperadminStepUp";
import { requireAdminIpAllowlist } from "../../middlewares/requireAdminIpAllowlist";
import {
  assignUserRole,
  getRoleAuditLogs,
  getRoleUsers,
  revokeUserRole,
} from "./security.admin.controller";

const securityAdminRouter = Router();

securityAdminRouter.get(
  "/roles/users",
  requireAuth,
  requirePermission("security.role.manage"),
  requireAdminIpAllowlist,
  getRoleUsers
);
securityAdminRouter.get(
  "/roles/audit",
  requireAuth,
  requirePermission("security.role.manage"),
  requireAdminIpAllowlist,
  getRoleAuditLogs
);
securityAdminRouter.post(
  "/roles/assign",
  requireAuth,
  requirePermission("security.role.manage"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  assignUserRole
);
securityAdminRouter.post(
  "/roles/revoke",
  requireAuth,
  requirePermission("security.role.manage"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  revokeUserRole
);

export { securityAdminRouter };
