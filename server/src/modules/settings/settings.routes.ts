import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { getSettings, patchSettings, postAvatarRequest } from "./settings.controller";

const settingsRouter = Router();

settingsRouter.get("/", requireAuth, getSettings);
settingsRouter.patch("/", requireAuth, patchSettings);
settingsRouter.post("/avatar-requests", requireAuth, postAvatarRequest);

export { settingsRouter };
