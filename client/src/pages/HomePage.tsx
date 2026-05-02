import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import icon from "../assets/icon.png"

const HERO_LINES = [
  "Chat smarter.",
  "Build faster.",
  "Think clearer.",
  "Respond instantly.",
]

const PREVIEW_MESSAGES = [
  {
    id: 1,
    side: "left",
    text: "Draft a reply to @elon about the new roadmap.",
  },
  {
    id: 2,
    side: "right",
    text: "Here's a concise response with next steps.",
  },
  {
    id: 3,
    side: "left",
    text: "Summarize the last 10 messages.",
  },
]

const FEATURES = [
  {
    title: "AI Chat Assistant",
    description: "Smart replies, summarization, and context-aware suggestions to keep teams moving.",
  },
  {
    title: "1-to-1 & Group Messaging",
    description: "Fast, organized conversations with threads, mentions, and readable history.",
  },
  {
    title: "Media Sharing",
    description: "Share images, videos, files, and maps without breaking your flow.",
  },
  {
    title: "Secure & Private Chats",
    description: "Privacy-first design with fine-grained controls and safe defaults.",
  },
  {
    title: "Multi-Device Support",
    description: "Stay in sync on desktop, tablet, and mobile with real-time updates.",
  },
  {
    title: "Role-Based Management",
    description: "Control access, moderation, and roles for healthy group spaces.",
  },
]

const HOW_IT_WORKS = [
  {
    title: "Create an account",
    description: "Set up your workspace in minutes with guided onboarding.",
  },
  {
    title: "Start chatting",
    description: "Message teammates or AI assistants and keep everything searchable.",
  },
  {
    title: "Create groups & share",
    description: "Spin up channels, drop files, and keep context together.",
  },
  {
    title: "Manage from one dashboard",
    description: "Invite, organize, and monitor conversations in one place.",
  },
]

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "per user / month",
    features: [
      "Core messaging",
      "1 workspace",
      "Limited AI credits",
      "Basic file sharing",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$12",
    cadence: "per user / month",
    features: [
      "Everything in Free",
      "Expanded AI credits",
      "Advanced search",
      "Priority support",
    ],
    cta: "Start Pro",
    popular: true,
  },
  {
    name: "Business",
    price: "$24",
    cadence: "per user / month",
    features: [
      "Everything in Pro",
      "Admin & compliance tools",
      "Role-based management",
      "Dedicated success",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

const TRUST_ITEMS = [
  {
    title: "End-to-end encryption",
    description: "Messages are protected in transit with modern cryptography.",
  },
  {
    title: "Secure authentication",
    description: "Token-based access with optional SSO and device management.",
  },
  {
    title: "Data protection",
    description: "Clear retention controls and export tools for your team.",
  },
  {
    title: "Reliable infrastructure",
    description: "Resilient systems designed for high-availability messaging.",
  },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{subtitle}</p>
      <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-text-primary">
        {title}
      </h2>
    </div>
  )
}

function IconTile({ label }: { label: string }) {
  return (
    <div className="w-11 h-11 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center text-sm font-semibold text-text-secondary">
      {label}
    </div>
  )
}

function FeaturesSection() {
  return (
    <section className="py-20 md:py-24 bg-bg-surface/30">
      <div className="max-w-6xl mx-auto px-8 md:px-16">
        <SectionHeader
          title="Everything you need to run modern conversations"
          subtitle="Features"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-3xl border border-border-subtle bg-bg-main/70 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-glow"
            >
              <IconTile label={feature.title.slice(0, 2).toUpperCase()} />
              <h3 className="mt-4 text-xl font-semibold text-text-primary">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-8 md:px-16">
        <SectionHeader title="Simple to start, powerful to scale" subtitle="How It Works" />
        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {HOW_IT_WORKS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-3xl border border-border-subtle bg-bg-surface/60 p-6 transition duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.3em] text-text-muted">
                  Step {index + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary-gradient text-white flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutSection() {
  return (
    <section className="py-20 md:py-24 bg-bg-main">
      <div className="max-w-6xl mx-auto px-8 md:px-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Vision</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-text-primary">
              Built for clarity in every conversation
            </h2>
            <p className="mt-5 text-base md:text-lg text-text-muted leading-relaxed">
              Euclit exists to remove friction from communication. We combine thoughtful
              design with reliable AI to keep conversations focused, secure, and easy to
              act on. Our mission is simple: let teams and communities move faster without
              sacrificing privacy or simplicity.
            </p>
          </div>
          <div className="rounded-3xl border border-border-subtle bg-bg-surface/70 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-text-muted">Product Philosophy</p>
            <ul className="mt-4 space-y-3 text-sm text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-primary-gradient" />
                Privacy-first defaults with transparent controls.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-primary-gradient" />
                Speedy, distraction-free interfaces that keep context visible.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 w-2 h-2 rounded-full bg-primary-gradient" />
                AI that enhances people, not replaces them.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function PricingSection({ onSelect }: { onSelect: () => void }) {
  return (
    <section className="py-20 md:py-24 bg-bg-surface/30">
      <div className="max-w-6xl mx-auto px-8 md:px-16">
        <SectionHeader title="Pricing that scales with your team" subtitle="Pricing" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-7 transition duration-300 hover:-translate-y-1 hover:shadow-glow ${plan.popular
                  ? "border-transparent bg-primary-gradient text-white"
                  : "border-border-subtle bg-bg-main/70"
                }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-bg-main px-3 py-1 text-xs font-semibold text-text-primary">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-semibold">
                {plan.name}
              </h3>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold">{plan.price}</span>
                <span className={`text-xs uppercase tracking-[0.2em] ${plan.popular ? "text-white/80" : "text-text-muted"}`}>
                  {plan.cadence}
                </span>
              </div>
              <ul className={`mt-6 space-y-3 text-sm ${plan.popular ? "text-white/90" : "text-text-secondary"}`}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className={`mt-1 w-2 h-2 rounded-full ${plan.popular ? "bg-white" : "bg-primary-gradient"}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSelect}
                className={`mt-8 w-full rounded-xl px-5 py-3 text-sm font-semibold transition ${plan.popular
                    ? "bg-bg-main text-text-primary hover:opacity-90"
                    : "bg-primary-gradient text-white hover:opacity-90"
                  }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-text-muted">
          AI credits scale with plan usage. Add more credits anytime as your team grows.
        </p>
      </div>
    </section>
  )
}

function SecuritySection() {
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-8 md:px-16">
        <SectionHeader title="Security you can trust" subtitle="Security & Trust" />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-border-subtle bg-bg-surface/60 p-6 transition duration-300 hover:-translate-y-1"
            >
              <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <section className="py-20 md:py-24 bg-bg-surface/40">
      <div className="max-w-5xl mx-auto px-8 md:px-16 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-primary">
          Ready to build clearer conversations?
        </h2>
        <p className="mt-4 text-base md:text-lg text-text-muted">
          Join teams using Euclit to message faster, stay aligned, and keep context in one place.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onPrimary}
            className="px-6 py-3 rounded-xl bg-primary-gradient text-white font-medium shadow-glow hover:opacity-90 transition"
          >
            Create Account
          </button>
          <button
            onClick={onSecondary}
            className="px-6 py-3 rounded-xl border border-border-subtle text-text-primary hover:bg-bg-surface/60 transition"
          >
            Login
          </button>
        </div>
      </div>
    </section>
  )
}

function FooterSection() {
  return (
    <footer className="border-t border-border-subtle bg-bg-main">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 md:py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-cyan-300/45 bg-zinc-950/85 shadow-[0_0_24px_-12px_rgba(34,211,238,0.95)] flex items-center justify-center shrink-0">
              <img src={icon} alt="Euclit logo" className="h-6 w-6 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary leading-tight">Euclit</p>
              <p className="text-xs text-text-muted leading-tight">AI-powered messaging platform</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <button className="hover:text-text-primary transition" type="button">
                Privacy Policy
              </button>
              <button className="hover:text-text-primary transition" type="button">
                Terms & Conditions
              </button>
            </div>
            <p className="text-sm text-text-muted">(c) {new Date().getFullYear()} Euclit. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function HomePage() {
  const navigate = useNavigate()

  const isLoggedIn = useMemo(() => {
    return Boolean(
      localStorage.getItem("plaxeai_token") ||
      localStorage.getItem("plaxeai_user") ||
      localStorage.getItem("token")
    );
    if (isLoggedIn) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);


  // 🔁 Hero text rotation
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_LINES.length)
    }, 2500)

    return () => clearInterval(interval)
  }, [])

  // 💬 Preview animation
  const [visibleMessages, setVisibleMessages] = useState<number>(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleMessages((prev) =>
        prev < PREVIEW_MESSAGES.length ? prev + 1 : prev
      )
    }, 900)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen w-full bg-bg-main text-text-primary">
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full z-20 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg border border-cyan-300/45 bg-zinc-950/85 shadow-[0_0_24px_-12px_rgba(34,211,238,0.95)] flex items-center justify-center">
              <img src={icon} alt="Euclit logo" className="h-7 w-7 object-contain" />
            </div>
            <span className="font-semibold text-xl text-text-primary hidden sm:block">
              Euclit
            </span>
          </div>
          <div />
        </div>

        <div className="flex flex-col md:flex-row min-h-[80vh]">
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-20 gap-6">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {HERO_LINES[heroIndex]}
              <br />
              <span className="text-text-secondary">
                Connect <span className="text-text-secondary bg-primary-gradient bg-clip-text text-transparent">faster.</span>
              </span>
            </h1>

            <p className="text-text-muted text-base md:text-lg max-w-xl">
              A focused workspace for AI and human conversations. Search, organize,
              and respond with clarity in one place.
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/login")}
                className="px-6 py-3 rounded-xl bg-primary-gradient text-white font-medium shadow-glow hover:opacity-90 transition"
              >
                {isLoggedIn ? "Go to Dashboard" : "Get Started"}
              </button>
            </div>
          </div>

          <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-glow blur-3xl" />

            <div className="relative z-10 w-[420px] h-[520px] bg-bg-surface/70 border border-border-subtle rounded-3xl p-6">
              <div className="h-full w-full rounded-2xl border border-border-subtle bg-bg-main p-6">
                <p className="text-xs uppercase tracking-widest text-text-muted">
                  Live Preview
                </p>

                <div className="mt-6 space-y-4">
                  {PREVIEW_MESSAGES.slice(0, visibleMessages).map((msg) => (
                    <div
                      key={msg.id}
                      className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm transition-all duration-500 ${msg.side === "left"
                          ? "bg-bg-elevated text-text-secondary"
                          : "bg-primary-gradient text-white ml-auto"
                        }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FeaturesSection />
      <HowItWorksSection />
      <AboutSection />
      <PricingSection onSelect={() => navigate("/login")} />
      <SecuritySection />
      <CTASection onPrimary={() => navigate("/login")} onSecondary={() => navigate("/login")} />
      <FooterSection />
    </div>
  )
}
