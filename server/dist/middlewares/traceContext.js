"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceContext = void 0;
const trace_service_1 = require("../modules/observability/trace.service");
const traceContext = (req, res, next) => {
    const headerTrace = String(req.headers["x-trace-id"] ?? "").trim();
    const traceId = headerTrace || trace_service_1.traceService.createTraceId();
    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);
    return trace_service_1.traceService.runWithTrace({
        traceId,
        requestId: typeof req.body?.requestId === "string" ? String(req.body.requestId).trim() : undefined,
        userId: req.user?.id,
    }, () => next());
};
exports.traceContext = traceContext;
