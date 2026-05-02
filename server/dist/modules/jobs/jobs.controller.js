"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminJobDetails = exports.postAdminRetryJob = exports.getAdminPendingJobs = exports.getAdminFailedJobs = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const jobs_service_1 = require("./jobs.service");
const getAdminFailedJobs = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
        const jobs = await jobs_service_1.jobsService.listFailedJobs(limit);
        return (0, response_1.sendSuccess)(res, { jobs });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminFailedJobs = getAdminFailedJobs;
const getAdminPendingJobs = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
        const jobs = await jobs_service_1.jobsService.listPendingJobs(limit);
        return (0, response_1.sendSuccess)(res, { jobs });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminPendingJobs = getAdminPendingJobs;
const postAdminRetryJob = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const jobId = String(req.body?.jobId ?? "").trim();
        if (!jobId)
            throw new errorHandler_1.AppError(400, "jobId is required");
        const job = await jobs_service_1.jobsService.retryDlqJob(jobId);
        return (0, response_1.sendSuccess)(res, { job }, "Job retry scheduled");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminRetryJob = postAdminRetryJob;
const getAdminJobDetails = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const jobId = String(req.params.jobId ?? "").trim();
        if (!jobId)
            throw new errorHandler_1.AppError(400, "jobId is required");
        const job = await jobs_service_1.jobsService.getJobDetails(jobId);
        if (!job)
            throw new errorHandler_1.AppError(404, "Job not found");
        return (0, response_1.sendSuccess)(res, { job });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminJobDetails = getAdminJobDetails;
