import { env } from "../../config/env";
import { securityService } from "./security.service";

let started = false;

const runAuditVerification = async () => {
  try {
    const configAudit = await securityService.verifyAuditChain();
    const adminAudit = await securityService.verifyAdminActionAuditChain();
    if (!configAudit.ok || !adminAudit.ok) {
      await securityService.logSecurityEvent({
        type: "AUDIT_CHAIN_FAILURE",
        details: {
          configAudit,
          adminAudit,
        },
      });
    }
    console.info(
      JSON.stringify({
        event: "security.audit.verify",
        configAudit,
        adminAudit,
        at: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("[security.audit.verify.error]", error);
  }
};

export const startSecurityWorkers = () => {
  if (started || !env.SECURITY_AUDIT_VERIFY_ENABLED) return;
  started = true;
  void runAuditVerification();
  setInterval(() => {
    void runAuditVerification();
  }, Math.max(60_000, env.SECURITY_AUDIT_VERIFY_INTERVAL_MS));
};
