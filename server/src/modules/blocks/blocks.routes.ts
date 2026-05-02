import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { deleteBlock, getBlocks, postBlock } from "./blocks.controller";

const blocksRouter = Router();

blocksRouter.get("/", requireAuth, getBlocks);
blocksRouter.post("/", requireAuth, postBlock);
blocksRouter.delete("/:userId", requireAuth, deleteBlock);

export { blocksRouter };
