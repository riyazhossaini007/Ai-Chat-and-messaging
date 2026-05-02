"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const socket_1 = require("./socket");
const reconciliation_worker_1 = require("./modules/billing/reconciliation.worker");
const reliability_service_1 = require("./modules/ai/reliability.service");
const jobs_service_1 = require("./modules/jobs/jobs.service");
const rbac_service_1 = require("./modules/security/rbac.service");
const observability_service_1 = require("./modules/observability/observability.service");
const security_worker_1 = require("./modules/security/security.worker");
const startupSecurity_1 = require("./security/startupSecurity");
const PORT = env_1.env.PORT;
const server = http_1.default.createServer(app_1.app);
(0, socket_1.initSocket)(server);
(0, startupSecurity_1.logStartupSecurityDiagnostics)();
server.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
    void rbac_service_1.rbacService.ensureRbacBootstrap();
    void (0, reconciliation_worker_1.startBillingWorkers)();
    (0, security_worker_1.startSecurityWorkers)();
    void observability_service_1.observabilityService.ensurePricingBootstrap();
    observability_service_1.observabilityService.startOpsWorkers();
    reliability_service_1.reliabilityService.startProviderProbes();
    if (env_1.env.FEATURE_BG_QUEUE) {
        jobs_service_1.jobsService.startJobsWorker();
    }
});
