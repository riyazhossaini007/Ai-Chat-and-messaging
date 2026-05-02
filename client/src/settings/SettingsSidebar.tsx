import {
  Bell,
  Bot,
  Brush,
  ChevronRight,
  ChartNoAxesCombined,
  CircleDollarSign,
  Cog,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import icon from "../assets/icon.png";

export type SettingsSectionId =
  | "general"
  | "appearance"
  | "notifications"
  | "privacy"
  | "chats"
  | "ai"
  | "billing"
  | "advanced";

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: typeof Cog;
}> = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "appearance", label: "Appearance", icon: Brush },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Security", icon: ShieldCheck },
    { id: "chats", label: "Chats & Media", icon: MessageSquareText },
    { id: "ai", label: "AI Settings", icon: Bot },
    { id: "billing", label: "Billing", icon: CircleDollarSign },
    { id: "advanced", label: "Advanced", icon: TriangleAlert },
  ];

type SettingsSidebarProps = {
  activeSection: SettingsSectionId;
  onChange: (section: SettingsSectionId) => void;
  onHomeClick?: () => void;
  onOpsClick?: () => void;
};

export default function SettingsSidebar({
  activeSection,
  onChange,
  onHomeClick,
  onOpsClick,
}: SettingsSidebarProps) {
  return (
    <aside className="w-full border-b border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 backdrop-blur-xl md:h-full md:w-72 md:shrink-0 md:border-b-0 md:border-r">
      <div className="border-b border-cyan-400/20 p-4 md:p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onHomeClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/45 bg-zinc-950/85 shadow-[0_0_24px_-12px_rgba(34,211,238,0.95)] transition hover:border-cyan-200/70 hover:shadow-[0_0_28px_-10px_rgba(34,211,238,1)]"
            aria-label="Go to home"
            title="Home"
          >
            <img src={icon} alt="Euclit logo" className="h-7 w-7 object-contain" />
          </button>
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold tracking-wide text-text-primary">Settings</h2>
            <p className="text-xs text-zinc-400">Choose a category to manage your account and app behavior.</p>
          </div>
        </div>
      </div>

      <nav className="px-2 py-3 md:px-3 md:py-4" aria-label="Settings sections">
        <div className="flex gap-2 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = id === activeSection;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={`group flex min-w-fit items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition md:w-full ${
                  active
                    ? "border-cyan-400/45 bg-cyan-400/15 text-white"
                    : "border-transparent text-zinc-400 hover:border-cyan-400/25 hover:bg-white/5 hover:text-text-primary"
                  }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex items-center gap-2">
                  <Icon size={16} />
                  <span>{label}</span>
                </span>
                <ChevronRight size={14} className={`transition ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={onOpsClick}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/30 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <ChartNoAxesCombined size={16} />
            Ops Dashboard
          </span>
          <ChevronRight size={14} />
        </button>
      </div>
    </aside>
  );
}
