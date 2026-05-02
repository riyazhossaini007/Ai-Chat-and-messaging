"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const prisma_1 = require("./config/prisma");
const auth_routes_1 = require("./modules/auth/auth.routes");
const ai_routes_1 = require("./modules/ai/ai.routes");
const billing_routes_1 = require("./modules/billing/billing.routes");
const blocks_routes_1 = require("./modules/blocks/blocks.routes");
const call_routes_1 = require("./modules/calls/call.routes");
const livekit_webhook_routes_1 = require("./modules/calls/livekit.webhook.routes");
const chat_routes_1 = require("./modules/chat/chat.routes");
const share_routes_1 = require("./modules/chat/share.routes");
const group_routes_1 = require("./modules/group/group.routes");
const media_routes_1 = require("./modules/media/media.routes");
const message_routes_1 = require("./modules/message/message.routes");
const jobs_routes_1 = require("./modules/jobs/jobs.routes");
const settings_routes_1 = require("./modules/settings/settings.routes");
const storage_routes_1 = require("./modules/storage/storage.routes");
const user_routes_1 = require("./modules/user/user.routes");
const observability_routes_1 = require("./modules/observability/observability.routes");
const security_admin_routes_1 = require("./modules/security/security.admin.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const search_routes_1 = require("./modules/search/search.routes");
const redisRateLimiter_service_1 = require("./modules/security/redisRateLimiter.service");
const health_routes_1 = require("./routes/health.routes");
const errorHandler_1 = require("./middlewares/errorHandler");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const traceContext_1 = require("./middlewares/traceContext");
const enforceHttps_1 = require("./middlewares/enforceHttps");
const app = (0, express_1.default)();
exports.app = app;
if (env_1.env.TRUST_PROXY) {
    app.set("trust proxy", 1);
}
const corsOrigin = env_1.env.CORS_ORIGIN === "*" ? true : env_1.env.CORS_ORIGIN;
app.use((0, cors_1.default)({ origin: corsOrigin, credentials: true }));
app.use(express_1.default.json({
    limit: "30mb",
    verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: "30mb" }));
app.use(enforceHttps_1.enforceHttps);
app.use((req, res, next) => {
    const forwardedProto = req.header("x-forwarded-proto");
    const isHttps = req.secure || forwardedProto === "https";
    if (env_1.env.ENFORCE_HTTPS && isHttps) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});
app.use(traceContext_1.traceContext);
app.use(rateLimiter_1.rateLimiter);
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
});
app.get("/readyz", async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        const redis = await redisRateLimiter_service_1.redisRateLimiterService.checkRedisReady();
        if (!redis.ok) {
            return res.status(503).json({
                status: "not_ready",
                checks: {
                    database: "ok",
                    redis: redis.reason,
                },
            });
        }
        res.status(200).json({
            status: "ready",
            checks: {
                database: "ok",
                redis: "ok",
            },
        });
    }
    catch {
        res.status(503).json({ status: "not_ready" });
    }
});
app.use("/auth", auth_routes_1.authRouter);
app.use("/ai", ai_routes_1.aiRouter);
app.use("/billing", billing_routes_1.billingRouter);
app.use("/blocks", blocks_routes_1.blocksRouter);
app.use("/calls", call_routes_1.callRouter);
app.use("/webhooks", livekit_webhook_routes_1.livekitWebhookRouter);
app.use("/users", user_routes_1.userRouter);
app.use("/chats", chat_routes_1.chatRouter);
app.use("/groups", group_routes_1.groupRouter);
app.use("/messages", message_routes_1.messageRouter);
app.use("/jobs", jobs_routes_1.jobsRouter);
app.use("/media", media_routes_1.mediaRouter);
app.use("/settings", settings_routes_1.settingsRouter);
app.use("/storage", storage_routes_1.storageRouter);
app.use("/share", share_routes_1.shareRouter);
app.use("/search", search_routes_1.searchRouter);
app.use("/ops", observability_routes_1.observabilityRouter);
app.use("/security/admin", security_admin_routes_1.securityAdminRouter);
app.use("/admin", admin_routes_1.adminRouter);
app.use(health_routes_1.healthRouter);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
