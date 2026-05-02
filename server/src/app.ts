import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { authRouter } from "./modules/auth/auth.routes";
import { aiRouter } from "./modules/ai/ai.routes";
import { billingRouter } from "./modules/billing/billing.routes";
import { blocksRouter } from "./modules/blocks/blocks.routes";
import { callRouter } from "./modules/calls/call.routes";
import { livekitWebhookRouter } from "./modules/calls/livekit.webhook.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { shareRouter } from "./modules/chat/share.routes";
import { groupRouter } from "./modules/group/group.routes";
import { mediaRouter } from "./modules/media/media.routes";
import { messageRouter } from "./modules/message/message.routes";
import { jobsRouter } from "./modules/jobs/jobs.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { storageRouter } from "./modules/storage/storage.routes";
import { userRouter } from "./modules/user/user.routes";
import { observabilityRouter } from "./modules/observability/observability.routes";
import { securityAdminRouter } from "./modules/security/security.admin.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { searchRouter } from "./modules/search/search.routes";
import { redisRateLimiterService } from "./modules/security/redisRateLimiter.service";
import { healthRouter } from "./routes/health.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { rateLimiter } from "./middlewares/rateLimiter";
import { traceContext } from "./middlewares/traceContext";
import { enforceHttps } from "./middlewares/enforceHttps";

const app = express();
if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

const corsOrigin = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(
  express.json({
    limit: "30mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = Buffer.from(buf);
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
app.use(enforceHttps);
app.use((req, res, next) => {
  const forwardedProto = req.header("x-forwarded-proto");
  const isHttps = req.secure || forwardedProto === "https";
  if (env.ENFORCE_HTTPS && isHttps) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(traceContext);
app.use(rateLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = await redisRateLimiterService.checkRedisReady();
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
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

app.use("/auth", authRouter);
app.use("/ai", aiRouter);
app.use("/billing", billingRouter);
app.use("/blocks", blocksRouter);
app.use("/calls", callRouter);
app.use("/webhooks", livekitWebhookRouter);
app.use("/users", userRouter);
app.use("/chats", chatRouter);
app.use("/groups", groupRouter);
app.use("/messages", messageRouter);
app.use("/jobs", jobsRouter);
app.use("/media", mediaRouter);
app.use("/settings", settingsRouter);
app.use("/storage", storageRouter);
app.use("/share", shareRouter);
app.use("/search", searchRouter);
app.use("/ops", observabilityRouter);
app.use("/security/admin", securityAdminRouter);
app.use("/admin", adminRouter);
app.use(healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
