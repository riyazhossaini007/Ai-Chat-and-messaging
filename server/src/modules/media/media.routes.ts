import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { getChatMedia } from "./media.controller";

const mediaRouter = Router();

mediaRouter.get("/chat/:chatId", requireAuth, getChatMedia);

export { mediaRouter };
