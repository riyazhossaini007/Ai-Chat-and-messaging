import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  getAdminFailedJobs,
  getAdminJobDetails,
  getAdminPendingJobs,
  postAdminRetryJob,
} from "./jobs.controller";

const jobsRouter = Router();

jobsRouter.get("/admin/failed", requireAuth, requirePermission("jobs.dlq.read"), getAdminFailedJobs);
jobsRouter.get("/admin/pending", requireAuth, requirePermission("jobs.dlq.read"), getAdminPendingJobs);
jobsRouter.get("/admin/:jobId", requireAuth, requirePermission("jobs.dlq.read"), getAdminJobDetails);
jobsRouter.post("/admin/retry", requireAuth, requirePermission("jobs.dlq.retry"), postAdminRetryJob);

export { jobsRouter };
