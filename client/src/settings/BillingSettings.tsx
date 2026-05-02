import { useMemo } from "react";
import type { SettingsSectionProps } from "./SettingsLayout";

export default function BillingSettings({ showToast }: SettingsSectionProps) {
  const invoices = useMemo(
    () => [
      { id: "INV-2026-001", date: "Jan 05, 2026", amount: "$19.00", status: "Paid" },
      { id: "INV-2025-012", date: "Dec 05, 2025", amount: "$19.00", status: "Paid" },
      { id: "INV-2025-011", date: "Nov 05, 2025", amount: "$9.00", status: "Paid" },
    ],
    []
  );

  const usageHistory = useMemo(
    () => [
      { month: "Nov 2025", credits: 58 },
      { month: "Dec 2025", credits: 71 },
      { month: "Jan 2026", credits: 72 },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Current Plan</h3>
        <p className="mt-1 text-xs text-text-muted">Transparent plan details with no hidden conditions.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/30 bg-zinc-950/65 p-4">
            <div className="text-sm font-semibold text-text-primary">Pro Plan</div>
            <div className="mt-1 text-xs text-text-muted">$19 / month, billed monthly</div>
            <div className="mt-3 text-xs text-text-muted">Includes 120 AI credits and priority support.</div>
          </div>

          <div className="rounded-xl border border-cyan-400/15 bg-zinc-950/65 p-4">
            <div className="text-sm font-semibold text-text-primary">AI Credits</div>
            <div className="mt-1 text-xs text-text-muted">72 used / 120 total</div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => showToast("Upgrade flow is ready")}
                className="rounded-lg bg-gradient-to-r from-cyan-300/85 to-emerald-300/80 px-3 py-1.5 text-xs text-zinc-950 hover:opacity-95"
              >
                Upgrade
              </button>
              <button
                type="button"
                onClick={() => showToast("Downgrade options opened")}
                className="rounded-lg border border-cyan-400/25 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
              >
                Downgrade
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Usage History</h3>

        <div className="mt-4 grid gap-2">
          {usageHistory.map((entry) => (
            <div key={entry.month} className="flex items-center justify-between rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-2 text-sm">
              <span className="text-text-primary">{entry.month}</span>
              <span className="text-text-muted">{entry.credits} credits</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Invoices</h3>

        <div className="mt-4 space-y-2">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-2 text-sm">
              <div>
                <div className="text-text-primary">{invoice.id}</div>
                <div className="text-xs text-text-muted">{invoice.date}</div>
              </div>
              <div className="text-text-secondary">{invoice.amount}</div>
              <button
                type="button"
                onClick={() => showToast(`Downloading ${invoice.id}`)}
                className="rounded-lg border border-cyan-400/25 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
