"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSecurityWorkers = void 0;
const env_1 = require("../../config/env");
const security_service_1 = require("./security.service");
let started = false;
const runAuditVerification = async () => {
    try {
        const configAudit = await security_service_1.securityService.verifyAuditChain();
        const adminAudit = await security_service_1.securityService.verifyAdminActionAuditChain();
        if (!configAudit.ok || !adminAudit.ok) {
            await security_service_1.securityService.logSecurityEvent({
                type: "AUDIT_CHAIN_FAILURE",
                details: {
                    configAudit,
                    adminAudit,
                },
            });
        }
        console.info(JSON.stringify({
            event: "security.audit.verify",
            configAudit,
            adminAudit,
            at: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error("[security.audit.verify.error]", error);
    }
};
const startSecurityWorkers = () => {
    if (started || !env_1.env.SECURITY_AUDIT_VERIFY_ENABLED)
        return;
    started = true;
    void runAuditVerification();
    setInterval(() => {
        void runAuditVerification();
    }, Math.max(60000, env_1.env.SECURITY_AUDIT_VERIFY_INTERVAL_MS));
};
exports.startSecurityWorkers = startSecurityWorkers;
