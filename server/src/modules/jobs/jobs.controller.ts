import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { jobsService } from "./jobs.service";

export const getAdminFailedJobs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const jobs = await jobsService.listFailedJobs(limit);
    return sendSuccess(res, { jobs });
  } catch (error) {
    return next(error);
  }
};

export const getAdminPendingJobs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const jobs = await jobsService.listPendingJobs(limit);
    return sendSuccess(res, { jobs });
  } catch (error) {
    return next(error);
  }
};

export const postAdminRetryJob = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const jobId = String(req.body?.jobId ?? "").trim();
    if (!jobId) throw new AppError(400, "jobId is required");
    const job = await jobsService.retryDlqJob(jobId);
    return sendSuccess(res, { job }, "Job retry scheduled");
  } catch (error) {
    return next(error);
  }
};

export const getAdminJobDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const jobId = String(req.params.jobId ?? "").trim();
    if (!jobId) throw new AppError(400, "jobId is required");
    const job = await jobsService.getJobDetails(jobId);
    if (!job) throw new AppError(404, "Job not found");
    return sendSuccess(res, { job });
  } catch (error) {
    return next(error);
  }
};
