import { jobsService } from "../jobs/jobs.service";
import { aiMemoryService } from "./ai-memory.service";

let registered = false;

export const registerAiMemoryJobs = () => {
  if (registered) return;
  registered = true;

  jobsService.registerHandler("knowledge_extract", async (payload) => {
    await aiMemoryService.runKnowledgeExtractionJob(payload);
  });
  jobsService.registerHandler("embedding_generate", async (payload) => {
    await aiMemoryService.runEmbeddingJob(payload);
  });
  jobsService.registerHandler("group_weekly_summary", async (payload) => {
    await aiMemoryService.runGroupSummaryJob(payload);
  });
  jobsService.registerHandler("stale_task_reconcile", async () => undefined);
  jobsService.registerHandler("topic_cluster_refresh", async () => undefined);
};
