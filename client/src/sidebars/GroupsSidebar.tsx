import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Image, MessageCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SidebarSearch from "../components/sidebarComponents/SidebarSearch";
import GroupList, { type GroupItem } from "../components/sidebarComponents/GroupList";
import type { GroupActionId } from "../components/sidebarComponents/GroupList";
import CreditsInfo from "../components/sidebarComponents/CreditsInfo";
import SidebarMediaList from "../components/sidebarComponents/SidebarMediaList";
import MediaScopeSelector from "../components/sidebarComponents/MediaScopeSelector";
import ProfileAccountCard, {
  type ProfileData,
  type UserType,
} from "../components/profileComponents/ProfileAccountCard";
import GroupChatSetupModal, {
  type GroupCreatePayload,
  type GroupMember,
} from "../components/sidebarComponents/GroupChatSetupModal";
import type { MediaScope, SidebarMediaItem } from "../components/sidebarComponents/media";
import icon from "../assets/icon.png";

type GroupsSidebarProps = {
  groups?: GroupItem[];
  activeGroupId?: string;
  activeSection?: "groups" | "media";
  user?: Partial<UserType>;
  credits?: number;
  onBuyCredits?: () => void;
  onHomeClick?: () => void;
  onOpenAiChat?: () => void;
  onOpenChats?: () => void;
  onOpenSettings?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  onUpdateProfile?: (data: ProfileData) => void;
  onAvatarChange?: (file: File) => void;
  onDeleteAccount?: () => void;
  onCreateGroup?: (data: GroupCreatePayload) => Promise<void> | void;
  groupUsers?: GroupMember[];
  onSelectGroup?: (group: GroupItem) => void;
  onGroupAction?: (
    action: GroupActionId,
    group: GroupItem
  ) => void;
  onSearch?: (value: string) => void;
  onSelectSection?: (section: "groups" | "media") => void;
  media?: SidebarMediaItem[];
  mediaScope?: MediaScope;
  onMediaScopeChange?: (scope: MediaScope) => void;
  unreadBadges?: {
    direct?: number;
    group?: number;
    ai?: number;
  };
};

export default function GroupsSidebar({
  groups = [],
  activeGroupId,
  activeSection = "groups",
  user,
  credits,
  onBuyCredits,
  onHomeClick,
  onOpenAiChat,
  onOpenChats,
  onOpenSettings,
  onProfileClick,
  onLogout,
  onUpdateProfile,
  onAvatarChange,
  onDeleteAccount,
  onCreateGroup,
  groupUsers = [],
  onSelectGroup,
  onGroupAction,
  onSearch,
  onSelectSection,
  media = [],
  mediaScope = "chat",
  onMediaScopeChange,
  unreadBadges,
}: GroupsSidebarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  const profileUser = useMemo<UserType>(() => {
    return {
      name: user?.name || "User",
      username: user?.username || "@user",
      email: user?.email || "user@example.com",
      phone: user?.phone || "",
      bio: user?.bio || "",
      avatar: user?.avatar || "",
    };
  }, [user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    onSearch?.(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const filteredGroups = useMemo(() => {
    if (!debouncedQuery) return groups;
    return groups.filter((group) => {
      const title = group.title.toLowerCase();
      const preview = (group.lastMessage ?? "").toLowerCase();
      const members = `${group.memberCount} members`.toLowerCase();
      return (
        title.includes(debouncedQuery) ||
        preview.includes(debouncedQuery) ||
        members.includes(debouncedQuery)
      );
    });
  }, [debouncedQuery, groups]);

  return (
    <div className="relative flex h-screen">
      <aside className="flex h-screen w-14 flex-col items-center border-r border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 text-text-primary backdrop-blur-xl">
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

        <div className="flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={() => onSelectSection?.("groups")}
            className={`relative group flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              activeSection === "groups"
                ? "border-cyan-400/45 bg-cyan-400/15 text-white"
                : "border-transparent text-text-muted hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
            }`}
            aria-label="Groups"
            title="Groups"
          >
            <Users size={18} />
            {(unreadBadges?.group ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-[10px] leading-5 text-white text-center">
                {(unreadBadges?.group ?? 0) > 99 ? "99+" : unreadBadges?.group}
              </span>
            )}
            {activeSection === "groups" && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary-gradient" />
            )}
          </button>
          {activeGroupId && (
            <button
              type="button"
              onClick={() => onSelectSection?.("media")}
              className={`relative group flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                activeSection === "media"
                  ? "border-cyan-400/45 bg-cyan-400/15 text-white"
                  : "border-transparent text-text-muted hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
              }`}
              aria-label="Media"
              title="Media"
            >
              <Image size={18} />
              {activeSection === "media" && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary-gradient" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAiChat}
            className="relative group flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-text-muted transition hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
            aria-label="AI Chat"
            title="AI Chat"
          >
            <Sparkles size={18} />
            {(unreadBadges?.ai ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-[10px] leading-5 text-white text-center">
                {(unreadBadges?.ai ?? 0) > 99 ? "99+" : unreadBadges?.ai}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenChats}
            className="relative group flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-text-muted transition hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
            aria-label="Chats"
            title="Chats"
          >
            <MessageCircle size={18} />
            {(unreadBadges?.direct ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-[10px] leading-5 text-white text-center">
                {(unreadBadges?.direct ?? 0) > 99 ? "99+" : unreadBadges?.direct}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1" />

        <div className="pb-3">
          <button
            ref={avatarRef}
            type="button"
            onClick={() => {
              setShowProfile(true);
              onProfileClick?.();
            }}
            className="h-10 w-10 overflow-hidden rounded-full border border-cyan-400/35 bg-bg-elevated shadow-[0_0_22px_-12px_rgba(34,211,238,0.85)]"
            aria-label="Open profile"
            title="Profile"
          >
            {profileUser.avatar ? (
              <img src={profileUser.avatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-primary-gradient" />
            )}
          </button>
        </div>
      </aside>

      <aside className="flex h-screen w-[280px] min-w-[280px] flex-col overflow-y-auto border-r border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 text-text-primary backdrop-blur-xl max-sm:w-[220px] max-sm:min-w-[220px]">
        <div className="sticky top-0 z-10 bg-zinc-950/85 shadow-[0_10px_30px_-25px_rgba(6,182,212,0.8)] backdrop-blur-xl">
          <div className="border-b border-cyan-400/20 px-4 py-4">
            <h1 className="text-lg font-bold tracking-wide text-text-primary">
              {activeSection === "media" ? "Media" : "Groups"}
            </h1>
          </div>
          <div className="px-3 py-2">
            <SidebarSearch
              open
              onOpenSidebar={() => {}}
              onSearch={setQuery}
            />
          </div>
          {activeSection === "groups" ? (
            <div className="space-y-2 px-3">
              <button
                type="button"
                onClick={() => setShowGroupModal(true)}
                className="w-full rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-300/75 to-emerald-300/70 px-3 py-2 text-sm font-medium text-zinc-950 hover:opacity-95"
              >
                Create New Group
              </button>
            </div>
          ) : (
            <MediaScopeSelector
              value={mediaScope}
              onChange={(scope) => onMediaScopeChange?.(scope)}
              canSelectThisChat={Boolean(activeGroupId)}
            />
          )}
        </div>

        <div className="mt-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          {activeSection === "groups" ? (
            filteredGroups.length === 0 && debouncedQuery ? (
              <div className="px-4 py-2 text-sm text-text-muted">
                No groups found for "{query.trim()}".
              </div>
            ) : (
              <GroupList
                groups={filteredGroups}
                activeId={activeGroupId}
                onSelectGroup={(group) => onSelectGroup?.(group)}
                onAction={(action, group) => onGroupAction?.(action, group)}
              />
            )
          ) : (
            <SidebarMediaList media={media} />
          )}
        </div>

        {typeof credits === "number" && onBuyCredits && (
          <div className="sticky bottom-0 z-10 items-center border-t border-cyan-400/20 bg-zinc-950/90 shadow-[0_-10px_30px_-25px_rgba(6,182,212,0.7)] backdrop-blur-xl">
            <CreditsInfo open credits={credits} onBuyCredits={onBuyCredits} />
          </div>
        )}
      </aside>

      <ProfileAccountCard
        open={showProfile}
        anchorRef={avatarRef}
        user={profileUser}
        onClose={() => setShowProfile(false)}
        onUpdateProfile={onUpdateProfile}
        onAvatarChange={onAvatarChange}
        onLogout={onLogout}
        onViewProfile={() => {
          setShowProfile(false);
          navigate("/profilepage");
        }}
        onDeleteAccount={onDeleteAccount}
        onOpenSettings={onOpenSettings}
      />

      {onCreateGroup && (
        <GroupChatSetupModal
          open={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onCreateGroup={onCreateGroup}
          users={groupUsers}
        />
      )}
    </div>
  );
}
