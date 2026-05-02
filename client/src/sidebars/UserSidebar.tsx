import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import MainSidebar from "../components/sidebarComponents/MainSidebar"
import ThinSidebar, { type SidebarSection } from "../components/sidebarComponents/ThinSidebar"
import ProfileAccountCard, {
  type ProfileData,
  type UserType,
} from "../components/profileComponents/ProfileAccountCard"
import GroupChatSetupModal, {
  type GroupCreatePayload,
  type GroupMember,
} from "../components/sidebarComponents/GroupChatSetupModal"
import type { MediaScope } from "../components/sidebarComponents/media";
import type { NearbyUserRecord } from "../api/types";

type UserSidebarProps = {
  activeSection?: SidebarSection;
  onSelectSection?: (section: SidebarSection) => void;
  onProfileClick?: () => void;
  onOpenAiChat?: () => void;
  onHomeClick?: () => void;
  user?: Partial<UserType>;
  chats?: any[];
  nearbyUsers?: NearbyUserRecord[];
  users?: any[];
  media?: any[];
  groups?: any[];
  credits?: number;
  onBuyCredits?: () => void;
  onLogout?: () => void;
  onUpdateProfile?: (data: ProfileData) => void;
  onAvatarChange?: (file: File) => void;
  onDeleteAccount?: () => void;
  onOpenSettings?: () => void;
  onCreateGroup?: (data: GroupCreatePayload) => Promise<void> | void;
  groupUsers?: GroupMember[];
  isUpdating?: boolean;
  isUploading?: boolean;
  errorMessage?: string;
  successMessage?: string;
  mediaScope?: MediaScope;
  onMediaScopeChange?: (scope: MediaScope) => void;
  canSelectThisChat?: boolean;
  showMediaSection?: boolean;
  onSelectNearbyUser?: (user: NearbyUserRecord) => void;
  onOpenMediaManager?: () => void;
  onPinChat?: (chatId: string) => void;
  onArchiveChat?: (chatId: string) => void;
  onUnarchiveChat?: (chatId: string) => void;
  onShareChat?: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  unreadBadges?: {
    direct?: number;
    group?: number;
    ai?: number;
  };
};

export function UserSidebar({
  activeSection,
  onSelectSection,
  onProfileClick,
  onOpenAiChat,
  onHomeClick,
  user,
  chats = [],
  nearbyUsers = [],
  users = [],
  media = [],
  groups = [],
  credits,
  onBuyCredits,
  onLogout,
  onUpdateProfile,
  onAvatarChange,
  onDeleteAccount,
  onOpenSettings,
  onCreateGroup,
  groupUsers = [],
  isUpdating,
  isUploading,
  errorMessage,
  successMessage,
  mediaScope = "chat",
  onMediaScopeChange,
  canSelectThisChat = true,
  showMediaSection = true,
  onSelectNearbyUser,
  onOpenMediaManager,
  onPinChat,
  onArchiveChat,
  onUnarchiveChat,
  onShareChat,
  onDeleteChat,
  unreadBadges,
}: UserSidebarProps) {
  const [internalSection, setInternalSection] = useState<SidebarSection>("chats")
  const [showProfile, setShowProfile] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
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
      <ThinSidebar
        activeSection={currentSection}
        onSelectSection={handleSelectSection}
        onProfileClick={() => {
          setShowProfile(true)
          onProfileClick?.()
        }}
        onOpenAiChat={onOpenAiChat}
        onHomeClick={onHomeClick}
        profileRef={avatarRef}
        avatarUrl={profileUser.avatar}
        visibleSections={
          showMediaSection
            ? ["chats", "users", "media", "groups"]
            : ["chats", "users", "groups"]
        }
        unreadBadges={unreadBadges}
      />
      <MainSidebar
        activeSection={currentSection}
        chats={chats}
        nearbyUsers={nearbyUsers}
        users={users}
        media={media}
        groups={groups}
        onNewGroup={() => setShowGroupModal(true)}
        credits={credits}
        onBuyCredits={onBuyCredits}
        mediaScope={mediaScope}
        onMediaScopeChange={onMediaScopeChange}
        canSelectThisChat={canSelectThisChat}
        onSelectNearbyUser={onSelectNearbyUser}
        onOpenMediaManager={onOpenMediaManager}
        onPinChat={onPinChat}
        onArchiveChat={onArchiveChat}
        onUnarchiveChat={onUnarchiveChat}
        onShareChat={onShareChat}
        onDeleteChat={onDeleteChat}
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

      {onCreateGroup && (
        <GroupChatSetupModal
          open={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onCreateGroup={onCreateGroup}
          users={groupUsers}
        />
      )}
    </div>
  )
}

export default UserSidebar
