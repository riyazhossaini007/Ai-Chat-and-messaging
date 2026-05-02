import { Activity, BarChart3, CreditCard, FileClock, ShieldAlert, Users, Shield, Bot, MessagesSquare, Phone, HeartPulse } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { PropsWithChildren } from "react";

const links = [
  { to: "/admin/overview", label: "Overview", icon: Activity },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/entitlements", label: "Entitlements", icon: Shield },
  { to: "/admin/ai/usage", label: "AI Usage", icon: Bot },
  { to: "/admin/reports", label: "Reports", icon: MessagesSquare },
  { to: "/admin/groups", label: "Groups", icon: Users },
  { to: "/admin/calls", label: "Calls", icon: Phone },
  { to: "/admin/audit", label: "Audit", icon: FileClock },
  { to: "/admin/system-health", label: "System", icon: HeartPulse },
  { to: "/admin/ops/today", label: "Today", icon: Activity },
  { to: "/admin/ops/trends", label: "Last 7 Days", icon: BarChart3 },
  { to: "/admin/ops/health", label: "Provider Health", icon: ShieldAlert },
  { to: "/admin/ops/billing", label: "Billing", icon: CreditCard },
  { to: "/admin/security/roles", label: "Roles", icon: ShieldAlert },
];

export default function AdminOpsShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[#020617] text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin Ops Dashboard</h1>
            <p className="text-sm text-zinc-400">Cost, reliability, health, and billing signals</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    isActive
                      ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
                      : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-cyan-400/30"
                  }`
                }
              >
                <Icon size={16} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
