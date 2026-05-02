import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requirePermission } from "../../middlewares/requirePermission";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireAdminIpAllowlist } from "../../middlewares/requireAdminIpAllowlist";
import { requireSuperadminStepUp } from "../../middlewares/requireSuperadminStepUp";
import {
  cancelAiChatStream,
  getAiAdminConfig,
  getAiModels,
  getProviderHealth,
  patchAiAdminConfig,
  postAiChat,
  postAiChatStream,
  verifyAuditChain,
} from "./ai.controller";
import { aiThreadRouter } from "./ai-thread.routes";
import { aiMemoryRouter } from "../ai-memory/ai-memory.routes";

const aiRouter = Router();
aiRouter.use("/", aiThreadRouter);
aiRouter.use("/", aiMemoryRouter);

aiRouter.get("/models", requireAuth, getAiModels);
aiRouter.get(
  "/health/providers",
  requireAuth,
  requirePermission("ai.config.read"),
  getProviderHealth
);
aiRouter.post("/chat", requireAuth, requireFeature("PRO_ACCESS"), postAiChat);
aiRouter.post("/chat/stream", requireAuth, requireFeature("PRO_ACCESS"), postAiChatStream);
aiRouter.post("/chat/cancel/:requestId", requireAuth, requireFeature("PRO_ACCESS"), cancelAiChatStream);
aiRouter.get("/admin/config", requireAuth, requirePermission("ai.config.read"), getAiAdminConfig);
aiRouter.patch(
  "/admin/config",
  requireAuth,
  requirePermission("ai.config.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  patchAiAdminConfig
);
aiRouter.get(
  "/admin/audit/verify",
  requireAuth,
  requirePermission("security.audit.read"),
  requireAdminIpAllowlist,
  verifyAuditChain
);

export { aiRouter };
