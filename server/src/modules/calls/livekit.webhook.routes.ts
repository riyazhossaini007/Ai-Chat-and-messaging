import { Router } from "express";
import { livekitWebhook } from "./call.controller";

const livekitWebhookRouter = Router();

livekitWebhookRouter.post("/livekit", livekitWebhook);

export { livekitWebhookRouter };
