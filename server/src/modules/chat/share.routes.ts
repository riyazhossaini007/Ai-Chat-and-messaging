import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { shareChat } from "./chat.controller";

const shareRouter = Router();

shareRouter.get("/chat/:id", requireAuth, shareChat);

export { shareRouter };
