import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { initSocket } from "./socket";
import { startBillingWorkers } from "./modules/billing/reconciliation.worker";
import { reliabilityService } from "./modules/ai/reliability.service";
import { jobsService } from "./modules/jobs/jobs.service";
import { rbacService } from "./modules/security/rbac.service";
import { observabilityService } from "./modules/observability/observability.service";
import { startSecurityWorkers } from "./modules/security/security.worker";
import { logStartupSecurityDiagnostics } from "./security/startupSecurity";

const PORT = env.PORT;
const server = http.createServer(app);
initSocket(server);
logStartupSecurityDiagnostics();

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  void rbacService.ensureRbacBootstrap();
  void startBillingWorkers();
  startSecurityWorkers();
  void observabilityService.ensurePricingBootstrap();
  observabilityService.startOpsWorkers();
  reliabilityService.startProviderProbes();
  if (env.FEATURE_BG_QUEUE) {
    jobsService.startJobsWorker();
  }
});
