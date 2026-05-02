import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { deleteMe, getMe, getNearbyUsers, patchMe } from "./user.controller";

const userRouter = Router();

userRouter.get("/me", requireAuth, getMe);
userRouter.get("/nearby", requireAuth, getNearbyUsers);
userRouter.patch("/me", requireAuth, patchMe);
userRouter.delete("/me", requireAuth, deleteMe);

export { userRouter };
