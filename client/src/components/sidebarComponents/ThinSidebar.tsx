import { MessageSquare, Image, Users, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import { motion } from "motion/react";
import { optimizedMotionStyle } from "../../lib/motionVariants";
import icon from "../../assets/icon.png";

export type SidebarSection = "chats" | "groups" | "media" | "users" | "settings";

type ThinSidebarProps = {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  onProfileClick?: () => void;
  onOpenAiChat?: () => void;
  onHomeClick?: () => void;
  profileRef?: RefObject<HTMLButtonElement | null>;
  avatarUrl?: string;
  visibleSections?: SidebarSection[];
  unreadBadges?: {
    direct?: number;
    group?: number;
    ai?: number;
  };
};

const sections: Array<{
  id: SidebarSection;
  label: string;
  icon: typeof MessageSquare;
}> = [
    { id: "chats", label: "Chats", icon: MessageSquare },
    { id: "media", label: "Media", icon: Image },
    { id: "groups", label: "Groups", icon: Users },
  ];

export default function ThinSidebar({
  activeSection,
  onSelectSection,
  onProfileClick,
  onOpenAiChat,
  onHomeClick,
  profileRef,
  avatarUrl,
  visibleSections,
  unreadBadges,
}: ThinSidebarProps) {
  const renderedSections = visibleSections
    ? sections.filter((section) => visibleSections.includes(section.id))
    : sections;

  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" } }}
      style={optimizedMotionStyle}
      className="flex h-screen w-14 flex-col items-center border-r border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 text-text-primary backdrop-blur-xl"
    >
      {/* Logo */}
      <div className="pt-3">
        <button
          type="button"
          onClick={onHomeClick}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/45 bg-zinc-950/85 shadow-[0_0_24px_-12px_rgba(34,211,238,0.95)] transition hover:border-cyan-200/70 hover:shadow-[0_0_28px_-10px_rgba(34,211,238,1)]"
          aria-label="Go to home"
          title="Home"
        >
          <img src={icon} alt="Euclit logo" className="h-7 w-7 object-contain" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-2 pt-4">
        {renderedSections.map(({ id, label, icon: Icon }) => {
          const badgeCount =
            id === "chats" ? unreadBadges?.direct ?? 0 : id === "groups" ? unreadBadges?.group ?? 0 : 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectSection(id)}
              className={`relative group flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                activeSection === id
                  ? "border-cyan-400/45 bg-cyan-400/15 text-white"
                  : "border-transparent text-text-muted hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
              }`}
              aria-label={label}
              title={label}
            >
              <Icon size={18} />
              {badgeCount > 0 && (
                <motion.span
                  key={`thin-badge-${id}-${badgeCount}`}
                  className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-[10px] leading-5 text-white text-center"
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </motion.span>
              )}
              {activeSection === id && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary-gradient" />
              )}
            </button>
          );
        })}
      </div>

      {onOpenAiChat && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenAiChat}
            className="relative group flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-text-muted transition hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
            aria-label="AI Chat"
            title="AI Chat"
          >
            <Sparkles size={18} />
            {(unreadBadges?.ai ?? 0) > 0 && (
              <motion.span
                key={`thin-ai-badge-${unreadBadges?.ai ?? 0}`}
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-[10px] leading-5 text-white text-center"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.14, ease: "easeOut" }}
              >
                {(unreadBadges?.ai ?? 0) > 99 ? "99+" : unreadBadges?.ai}
              </motion.span>
            )}
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Profile */}
      <div className="pb-3">
        <button
          ref={profileRef}
          type="button"
          onClick={onProfileClick}
          className="h-10 w-10 overflow-hidden rounded-full border border-cyan-400/35 bg-bg-elevated shadow-[0_0_22px_-12px_rgba(34,211,238,0.85)]"
          aria-label="Open profile"
          title="Profile"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-primary-gradient" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
