"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAiMemoryJobs = void 0;
const jobs_service_1 = require("../jobs/jobs.service");
const ai_memory_service_1 = require("./ai-memory.service");
let registered = false;
const registerAiMemoryJobs = () => {
    if (registered)
        return;
    registered = true;
    jobs_service_1.jobsService.registerHandler("knowledge_extract", async (payload) => {
        await ai_memory_service_1.aiMemoryService.runKnowledgeExtractionJob(payload);
    });
    jobs_service_1.jobsService.registerHandler("embedding_generate", async (payload) => {
        await ai_memory_service_1.aiMemoryService.runEmbeddingJob(payload);
    });
    jobs_service_1.jobsService.registerHandler("group_weekly_summary", async (payload) => {
        await ai_memory_service_1.aiMemoryService.runGroupSummaryJob(payload);
    });
    jobs_service_1.jobsService.registerHandler("stale_task_reconcile", async () => undefined);
    jobs_service_1.jobsService.registerHandler("topic_cluster_refresh", async () => undefined);
};
exports.registerAiMemoryJobs = registerAiMemoryJobs;
