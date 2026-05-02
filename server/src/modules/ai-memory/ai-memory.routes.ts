import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  getGroupDecisions,
  getGroupInsights,
  getGroupTasks,
  getKnowledge,
  getMemorySearch,
  patchKnowledge,
  postContextRespond,
  postKnowledgeExtract,
  postMemoryForget,
  postMemoryPin,
} from "./ai-memory.controller";
import { registerAiMemoryJobs } from "./ai-memory.jobs";

registerAiMemoryJobs();

const aiMemoryRouter = Router();

aiMemoryRouter.post("/knowledge/extract", requireAuth, postKnowledgeExtract);
aiMemoryRouter.get("/knowledge", requireAuth, getKnowledge);
aiMemoryRouter.patch("/knowledge/:id", requireAuth, patchKnowledge);
aiMemoryRouter.post("/memory/pin", requireAuth, postMemoryPin);
aiMemoryRouter.post("/memory/forget", requireAuth, postMemoryForget);
aiMemoryRouter.get("/memory/search", requireAuth, getMemorySearch);
aiMemoryRouter.get("/groups/:groupId/insights", requireAuth, getGroupInsights);
aiMemoryRouter.get("/groups/:groupId/decisions", requireAuth, getGroupDecisions);
aiMemoryRouter.get("/groups/:groupId/tasks", requireAuth, getGroupTasks);
aiMemoryRouter.post("/context/respond", requireAuth, postContextRespond);

export { aiMemoryRouter };
