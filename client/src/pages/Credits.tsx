import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { layoutTransition, slidePanelVariant } from "../lib/motionVariants";
import { goHomeWithTransition } from "../lib/navigation";
import icon from "../assets/icon.png";

type BillingCycle = "monthly" | "yearly";

type CreditPack = {
  id: string;
  credits: number;
  price: number;
  bestValue?: boolean;
};

const YEARLY_DISCOUNT_PERCENT = 20;

const SUBSCRIPTION_PRICING = {
  monthly: 19,
  yearly: 182,
};

const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-50", credits: 50, price: 6 },
  { id: "pack-100", credits: 100, price: 10, bestValue: true },
  { id: "pack-250", credits: 250, price: 22 },
];

const FREE_FEATURES = [
  "Unlimited user-to-user messaging",
  "Group messaging and chat basics",
  "Calls (future) at no extra cost",
  "Core social communication features",
];

const FREE_LIMITS = [
  "No AI chat credits included",
  "No AI image generation credits included",
  "No premium support",
];

const SUBSCRIPTION_FEATURES = [
  "2,000 credits added every month",
  "Faster responses and priority queue",
  "Premium models, AI avatars, and group tools",
  "More history, uploads, and higher limits",
  "Discount on extra credit top-ups",
];

export default function Credits() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPackId, setSelectedPackId] = useState<string>(CREDIT_PACKS[1].id);

  const subscriptionPrice = useMemo(
    () => SUBSCRIPTION_PRICING[billingCycle],
    [billingCycle]
  );

  const selectedPack = useMemo(
    () => CREDIT_PACKS.find((pack) => pack.id === selectedPackId) ?? CREDIT_PACKS[0],
    [selectedPackId]
  );

  return (
    <div className="min-h-screen bg-[#020617] text-text-primary">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-36 -left-28 h-[520px] w-[520px] bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 -right-24 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)] blur-3xl" />

        <motion.div
          variants={slidePanelVariant}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="mx-auto max-w-7xl px-6 pb-14 pt-8 md:pb-20 md:pt-10"
        >
          <div className="mb-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => goHomeWithTransition(navigate)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/45 bg-zinc-950/85 shadow-[0_0_24px_-12px_rgba(34,211,238,0.95)] transition hover:border-cyan-200/70 hover:shadow-[0_0_28px_-10px_rgba(34,211,238,1)]"
              aria-label="Go to home"
              title="Home"
            >
              <img src={icon} alt="Euclit logo" className="h-7 w-7 object-contain" />
            </button>
            <div className="text-lg font-semibold tracking-wide text-white">Euclit</div>
          </div>

          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-text-muted">Credits & Plans</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Pick how you want to use AI credits
            </h1>
            <p className="mt-4 text-sm text-text-muted md:text-base">
              AI credits are used for AI chat and AI image generating. User messaging and calls
              (future) are completely free.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <motion.article
              layout
              transition={layoutTransition}
              whileHover={{ y: -2 }}
              className="rounded-3xl border border-cyan-400/20 bg-zinc-900/45 p-6 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Starter</h2>
                <span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted">
                  Free
                </span>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                AI credits are used for AI chat and AI image generating. User messaging and calls
                (future) are completely free.
              </p>

              <div className="mt-5 space-y-2 text-sm">
                {FREE_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">+</span>
                    <span>{feature}</span>
                  </div>
                ))}
                {FREE_LIMITS.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-text-muted">
                    <span className="mt-1 text-rose-400">-</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:bg-white/5"
              >
                Continue Free
              </button>
            </motion.article>

            <motion.article
              layout
              transition={layoutTransition}
              whileHover={{ y: -2 }}
              className="relative scale-[1.01] rounded-3xl border border-cyan-400/35 bg-zinc-900/60 p-6 shadow-[0_30px_80px_-48px_rgba(6,182,212,0.9)] backdrop-blur"
            >
              <span className="absolute -top-3 left-5 rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                Most Popular
              </span>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Subscription</h2>
                {billingCycle === "yearly" && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    Save {YEARLY_DISCOUNT_PERCENT}%
                  </span>
                )}
              </div>

              <div className="mt-4 inline-flex rounded-full border border-border-subtle bg-bg-main/80 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-full px-3 py-1.5 transition ${
                    billingCycle === "monthly"
                      ? "bg-primary-gradient text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`rounded-full px-3 py-1.5 transition ${
                    billingCycle === "yearly"
                      ? "bg-primary-gradient text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Yearly
                </button>
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-semibold">${subscriptionPrice}</span>
                <span className="pb-1 text-sm text-text-muted">
                  / {billingCycle === "monthly" ? "month" : "year"}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                {SUBSCRIPTION_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">+</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-xl bg-primary-gradient px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {billingCycle === "monthly" ? "Start Monthly" : "Start Yearly"}
              </button>
            </motion.article>

            <motion.article
              layout
              transition={layoutTransition}
              whileHover={{ y: -2 }}
              className="rounded-3xl border border-cyan-400/20 bg-zinc-900/45 p-6 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">One-time Credits</h2>
                <span className="rounded-full border border-primary-blue/30 bg-primary-blue/10 px-3 py-1 text-xs font-medium text-primary-blue">
                  No Expiry
                </span>
              </div>
              <p className="mt-2 text-sm text-text-muted">Buy once and use anytime. Credits never expire.</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {CREDIT_PACKS.map((pack) => {
                  const isSelected = pack.id === selectedPackId;
                  return (
                    <motion.button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedPackId(pack.id)}
                      animate={isSelected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        isSelected
                          ? "border-primary-blue/60 bg-primary-blue/15 text-text-primary"
                          : "border-border-subtle text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {pack.credits} credits
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2 text-sm text-text-secondary">
                {CREDIT_PACKS.map((pack) => (
                  <div
                    key={`${pack.id}-price`}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      pack.id === selectedPackId
                        ? "border-primary-blue/40 bg-primary-blue/10"
                        : "border-border-subtle bg-bg-main/40"
                    }`}
                  >
                    <span>{pack.credits} credits</span>
                    <span className="font-medium">
                      ${pack.price}
                      {pack.bestValue ? "  |  Best value" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-text-muted">
                1 message uses credits (varies by model and media generation).
              </p>

              <button
                type="button"
                className="mt-6 w-full rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              >
                Buy Credits (${selectedPack.price})
              </button>
            </motion.article>
          </div>

          <motion.section
            layout
            transition={layoutTransition}
            className="mt-10 rounded-3xl border border-cyan-400/20 bg-zinc-900/45 p-6 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-7"
          >
            <h3 className="text-lg font-semibold">How credits work</h3>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li>Credits are used when you send AI messages or generate media.</li>
              <li>Premium models cost more credits.</li>
              <li>Subscriptions renew credits monthly.</li>
              <li>One-time credits never expire.</li>
            </ul>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}
