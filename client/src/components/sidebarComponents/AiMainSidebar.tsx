import AiChatHistoryList from "./AiChatHistoryList";
import SidebarMediaList from "./SidebarMediaList";
import AiAvatarGrid from "./AiAvatarGrid";
import CreditsInfo from "./CreditsInfo";
import SidebarSearch from "./SidebarSearch";
import AiNewChatButton from "./OpenNew";
import type { SidebarSection } from "./ThinSidebar";
import { aiAvatars } from "./aiAvatars";
import MediaScopeSelector from "./MediaScopeSelector";
import type { MediaScope, SidebarMediaItem } from "./media";
import type { AiChatHistoryItem } from "./AiChatHistoryList";
import { motion } from "motion/react";
import { optimizedMotionStyle } from "../../lib/motionVariants";
import { useEffect, useMemo, useState } from "react";

type AiMainSidebarProps = {
  activeSection: SidebarSection;
  aiChats: AiChatHistoryItem[];
  media: SidebarMediaItem[];
  credits?: number;
  onBuyCredits?: () => void;
  onSearch?: (value: string) => void;
  onSelectAvatar?: (avatarId: string) => void;
  selectedAvatarId?: string | null;
  mediaScope?: MediaScope;
  onMediaScopeChange?: (scope: MediaScope) => void;
  canSelectThisChat?: boolean;
  onRenameAiChat?: (chat: AiChatHistoryItem) => void;
  onShareAiChatInApp?: (chat: AiChatHistoryItem) => void;
  onShareAiChatOutside?: (chat: AiChatHistoryItem) => void;
  onPinAiChat?: (chat: AiChatHistoryItem) => void;
  onDeleteAiChat?: (chat: AiChatHistoryItem) => void;
  selectedAiChatId?: string | null;
  onRequestAvatar?: (payload: { name: string; useCase: string; tone: string }) => Promise<void> | void;
};

const sectionTitle: Record<SidebarSection, string> = {
  chats: "AI Chats",
  groups: "Groups",
  media: "Media",
  users: "AI Avatars",
  settings: "Settings",
};

export default function AiMainSidebar({
  activeSection,
  aiChats,
  media,
  credits,
  onBuyCredits,
  onSearch,
  onSelectAvatar,
  mediaScope = "chat",
  onMediaScopeChange,
  canSelectThisChat = true,
  onRenameAiChat,
  onShareAiChatInApp,
  onShareAiChatOutside,
  onPinAiChat,
  onDeleteAiChat,
  selectedAiChatId,
  onRequestAvatar,
}: AiMainSidebarProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    onSearch?.(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const filteredAiChats = useMemo(() => {
    if (!debouncedQuery) return aiChats;
    return aiChats.filter((chat) => (chat.title || "New AI Chat").toLowerCase().includes(debouncedQuery));
  }, [aiChats, debouncedQuery]);

  const filteredAvatars = useMemo(() => {
    if (!debouncedQuery) return aiAvatars;
    return aiAvatars.filter((avatar) => {
      const name = avatar.name.toLowerCase();
      const role = (avatar.role ?? "").toLowerCase();
      return name.includes(debouncedQuery) || role.includes(debouncedQuery);
    });
  }, [debouncedQuery]);

  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" } }}
      style={optimizedMotionStyle}
      className="flex h-screen w-60 flex-col overflow-y-auto border-r border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 text-text-primary backdrop-blur-xl"
    >
      <div className="sticky top-0 z-10 bg-zinc-950/85 shadow-[0_10px_30px_-25px_rgba(6,182,212,0.8)] backdrop-blur-xl">
        <div className="border-b border-cyan-400/20 px-3 py-4">
          <h1 className="text-lg justify-center font-semibold ">
            Euclit
          </h1>
        </div>

        <div className="px-2 py-2">
          <SidebarSearch
            open
            onOpenSidebar={() => { }}
            onSearch={setQuery}
          />
        </div>

      {activeSection !== "users" && (
        <div className="px-2 py-2">
          <AiNewChatButton
            open
            forceSidebarOpen={() => { }}
          />
        </div>
      )}
        <h1 className="px-3 pb-1 text-sm font-semibold tracking-wide text-text-primary">
          {sectionTitle[activeSection]}
        </h1>
        {activeSection === "media" && (
          <MediaScopeSelector
            value={mediaScope}
            onChange={(scope) => onMediaScopeChange?.(scope)}
            canSelectThisChat={canSelectThisChat}
          />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {activeSection === "chats" && (
          filteredAiChats.length === 0 && debouncedQuery ? (
            <div className="px-4 py-3 text-sm text-text-muted">
              No AI chats found for "{query.trim()}".
            </div>
          ) : (
            <AiChatHistoryList
              open={true}
              chats={filteredAiChats}
              onRenameChat={onRenameAiChat}
              onShareInAppChat={onShareAiChatInApp}
              onShareOutsideChat={onShareAiChatOutside}
              onPinChat={onPinAiChat}
              onDeleteChat={onDeleteAiChat}
              selectedChatId={selectedAiChatId}
            />
          )
        )}
        {activeSection === "users" && (
          filteredAvatars.length === 0 && debouncedQuery ? (
            <div className="px-4 py-3 text-sm text-text-muted">
              No AI avatars found for "{query.trim()}".
            </div>
          ) : (
            <AiAvatarGrid
              avatars={filteredAvatars}
              onSelectAvatar={(avatar) => onSelectAvatar?.(avatar.id)}
              onRequestAvatar={onRequestAvatar}
            />
          )
        )}
        {activeSection === "media" && (
          <SidebarMediaList media={media} />
        )}
        {activeSection === "groups" && (
          <div className="p-4 text-sm text-text-muted">
            Groups are not available in AI chat.
          </div>
        )}
        {activeSection === "settings" && (
          <div className="p-4 text-sm text-text-muted">
            Settings panel coming soon.
          </div>
        )}
      </div>

      {typeof credits === "number" && onBuyCredits && (
        <div className="sticky bottom-0 z-10 border-t border-cyan-400/20 bg-zinc-950/90 shadow-[0_-10px_30px_-25px_rgba(6,182,212,0.7)] backdrop-blur-xl">
          <CreditsInfo open={true} credits={credits} onBuyCredits={onBuyCredits} />
        </div>
      )}
    </motion.aside>
  );
}
