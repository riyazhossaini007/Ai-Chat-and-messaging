import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { getSemanticSearch } from "./search.controller";

const searchRouter = Router();

searchRouter.get("/semantic", requireAuth, getSemanticSearch);

export { searchRouter };
