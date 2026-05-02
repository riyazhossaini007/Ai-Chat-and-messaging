import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { getStorageUsage } from "./storage.controller";

const storageRouter = Router();

storageRouter.get("/usage", requireAuth, getStorageUsage);

export { storageRouter };

