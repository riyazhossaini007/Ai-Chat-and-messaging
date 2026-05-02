import { NextFunction, Response } from "express";
import { traceService } from "../modules/observability/trace.service";
import { AuthRequest } from "../types";

export const traceContext = (req: AuthRequest, res: Response, next: NextFunction) => {
  const headerTrace = String(req.headers["x-trace-id"] ?? "").trim();
  const traceId = headerTrace || traceService.createTraceId();
  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);

  return traceService.runWithTrace(
    {
      traceId,
      requestId:
        typeof req.body?.requestId === "string" ? String(req.body.requestId).trim() : undefined,
      userId: req.user?.id,
    },
    () => next()
  );
};
