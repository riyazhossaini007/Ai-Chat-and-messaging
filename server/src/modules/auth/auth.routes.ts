import { Router } from "express";
import { login, logout, register, startAdminStepUp, verify, verifyAdminStepUp } from "./auth.controller";
import {
  validateLogin,
  validateRegister,
  validateVerify,
} from "./auth.validation";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";

const authRouter = Router();

authRouter.post("/register", validate(validateRegister), register);
authRouter.post("/verify", validate(validateVerify), verify);
authRouter.post("/login", validate(validateLogin), login);
authRouter.post("/logout", logout);
authRouter.post("/admin/step-up/start", requireAuth, startAdminStepUp);
authRouter.post("/admin/step-up/verify", requireAuth, verifyAdminStepUp);

export { authRouter };
