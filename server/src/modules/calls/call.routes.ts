import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import {
  acceptCall,
  declineCall,
  endCall,
  endSfu,
  getCallById,
  getCallHistory,
  joinSfu,
  leaveSfu,
  startCall,
} from "./call.controller";

const callRouter = Router();

callRouter.post("/start", requireAuth, requireFeature("CALLING"), startCall);
callRouter.post("/:callId/accept", requireAuth, requireFeature("CALLING"), acceptCall);
callRouter.post("/:callId/decline", requireAuth, requireFeature("CALLING"), declineCall);
callRouter.post("/:callId/end", requireAuth, requireFeature("CALLING"), endCall);
callRouter.post("/:callId/sfu/join", requireAuth, requireFeature("CALLING"), joinSfu);
callRouter.post("/:callId/sfu/leave", requireAuth, requireFeature("CALLING"), leaveSfu);
callRouter.post("/:callId/sfu/end", requireAuth, requireFeature("CALLING"), endSfu);
callRouter.get("/history", requireAuth, requireFeature("CALLING"), getCallHistory);
callRouter.get("/:callId", requireAuth, requireFeature("CALLING"), getCallById);

export { callRouter };
