import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import AiThinSidebar from "../components/sidebarComponents/AiThinSidebar"
import { type SidebarSection } from "../components/sidebarComponents/ThinSidebar"
import ProfileAccountCard, {
  type ProfileData,
  type UserType,
} from "../components/profileComponents/ProfileAccountCard"
import AiMainSidebar from "../components/sidebarComponents/AiMainSidebar"
import type { MediaScope, SidebarMediaItem } from "../components/sidebarComponents/media";
import type { AiChatHistoryItem } from "../components/sidebarComponents/AiChatHistoryList";

type AISidebarProps = {
  activeSection?: SidebarSection;
  onSelectSection?: (section: SidebarSection) => void;
  user?: Partial<UserType>;
  aiChats?: AiChatHistoryItem[];
  media?: SidebarMediaItem[];
  credits?: number;
  onBuyCredits?: () => void;
  onLogout?: () => void;
  onHomeClick?: () => void;
  onOpenChats?: () => void;
  onOpenGroups?: () => void;
  onUpdateProfile?: (data: ProfileData) => void;
  onAvatarChange?: (file: File) => void;
  onDeleteAccount?: () => void;
  onOpenSettings?: () => void;
  isUpdating?: boolean;
  isUploading?: boolean;
  errorMessage?: string;
  successMessage?: string;
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
  unreadBadges?: {
    direct?: number;
    group?: number;
    ai?: number;
  };
};

export function AISidebar({
  user,
  onLogout,
  credits,
  onBuyCredits,
  onHomeClick,
  onOpenChats,
  onOpenGroups,
  activeSection,
  onSelectSection,
  aiChats = [],
  media = [],
  onUpdateProfile,
  onAvatarChange,
  onDeleteAccount,
  onOpenSettings,
  isUpdating,
  isUploading,
  errorMessage,
  successMessage,
  onSelectAvatar,
  selectedAvatarId,
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
  unreadBadges,
}: AISidebarProps) {
  const [internalSection, setInternalSection] = useState<SidebarSection>("chats")
  const [showProfile, setShowProfile] = useState(false)
  const avatarRef = useRef<HTMLButtonElement | null>(null)
  const navigate = useNavigate()

  const currentSection = activeSection ?? internalSection

  const profileUser = useMemo<UserType>(() => {
    return {
      name: user?.name || "User",
      username: user?.username || "@user",
      email: user?.email || "user@example.com",
      phone: user?.phone || "",
      bio: user?.bio || "",
      avatar: user?.avatar || "",
    }
  }, [user])

  const handleSelectSection = (section: SidebarSection) => {
    setInternalSection(section)
    onSelectSection?.(section)
  }

  return (
    <div className="relative flex h-screen">
      <AiThinSidebar
        activeSection={currentSection}
        onSelectSection={handleSelectSection}
        onProfileClick={() => setShowProfile(true)}
        onHomeClick={onHomeClick}
        onOpenChats={onOpenChats}
        onOpenGroups={onOpenGroups}
        profileRef={avatarRef}
        avatarUrl={profileUser.avatar}
        unreadBadges={unreadBadges}
      />
      <AiMainSidebar
        activeSection={currentSection}
        aiChats={aiChats}
        media={media}
        credits={credits}
        onBuyCredits={onBuyCredits}
        onSelectAvatar={onSelectAvatar}
        selectedAvatarId={selectedAvatarId}
        mediaScope={mediaScope}
        onMediaScopeChange={onMediaScopeChange}
        canSelectThisChat={canSelectThisChat}
        onRenameAiChat={onRenameAiChat}
        onShareAiChatInApp={onShareAiChatInApp}
        onShareAiChatOutside={onShareAiChatOutside}
        onPinAiChat={onPinAiChat}
        onDeleteAiChat={onDeleteAiChat}
        selectedAiChatId={selectedAiChatId}
        onRequestAvatar={onRequestAvatar}
      />
      <ProfileAccountCard
        open={showProfile}
        anchorRef={avatarRef}
        user={profileUser}
        onClose={() => setShowProfile(false)}
        onUpdateProfile={onUpdateProfile}
        onAvatarChange={onAvatarChange}
        onLogout={onLogout}
        onViewProfile={() => {
          setShowProfile(false)
          navigate("/profilepage")
        }}
        onDeleteAccount={onDeleteAccount}
        onOpenSettings={onOpenSettings}
        isUpdating={isUpdating}
        isUploading={isUploading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />
    </div>
  )
}

export default AISidebar
