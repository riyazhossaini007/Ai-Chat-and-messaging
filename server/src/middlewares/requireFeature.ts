import type { EntitlementFeatureKey } from "@prisma/client";
import type { NextFunction, Response } from "express";
import { featureGateService } from "../modules/admin/featureGate.service";
import type { AuthRequest } from "../types";
import { AppError } from "./errorHandler";

export const requireFeature = (featureKey: EntitlementFeatureKey) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError(401, "Unauthorized");
      const allowed = await featureGateService.canUseFeature(req.user.id, featureKey);
      if (!allowed) {
        throw new AppError(402, "Feature access required", {
          code: "feature-required",
          featureKey,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

