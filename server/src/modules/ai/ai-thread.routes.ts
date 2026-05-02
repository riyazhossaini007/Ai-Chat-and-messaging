import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  getAiThread,
  postAiThread,
  postAiThreadForward,
  postAiThreadShare,
  postAiThreadTurn,
} from "./ai-thread.controller";

const aiThreadRouter = Router();

aiThreadRouter.post("/threads", requireAuth, postAiThread);
aiThreadRouter.get("/threads/:threadId", requireAuth, getAiThread);
aiThreadRouter.post("/threads/:threadId/turns", requireAuth, postAiThreadTurn);
aiThreadRouter.post("/threads/:threadId/share", requireAuth, postAiThreadShare);
aiThreadRouter.post("/threads/:threadId/forward", requireAuth, postAiThreadForward);

export { aiThreadRouter };

