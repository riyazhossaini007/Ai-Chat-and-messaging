import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { AISidebar } from "../sidebars/AISidebar";
import AiAvatarChatContainer from "../containers/AiAvatarChatContainer";
import { aiAvatars } from "../components/sidebarComponents/aiAvatars";
import { aiAvatarChats } from "../components/sidebarComponents/aiAvatarChats";
import type { SidebarSection } from "../components/sidebarComponents/ThinSidebar";
import { aiMediaItems, type MediaScope } from "../components/sidebarComponents/media";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { patchMe } from "../api/user.api";
import { createAvatarRequest } from "../api/settings.api";
import type { ProfileData } from "../components/profileComponents/ProfileAccountCard";
import { goHomeWithTransition } from "../lib/navigation";

export default function AiAvatarPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { avatarId } = useParams<{ avatarId: string }>();
  const authUser = useAuthStore((store) => store.user);
  const token = useAuthStore((store) => store.token);
  const updateAuthUser = useAuthStore((store) => store.updateUser);
  const clearSession = useAuthStore((store) => store.clearSession);
  const unreadSummary = useChatStore((store) => store.unreadSummary);
  const [mainSidebarMode, setMainSidebarMode] = useState<SidebarSection>(
    (state as { activeSection?: SidebarSection } | null)?.activeSection ?? "chats"
  );
  const [mediaScope, setMediaScope] = useState<MediaScope>("chat");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const avatar = useMemo(
    () => aiAvatars.find((item) => item.id === avatarId) ?? null,
    [avatarId]
  );

  const avatarChats = useMemo(() => {
    if (!avatarId) return [];
    return aiAvatarChats[avatarId] ?? [];
  }, [avatarId]);

  const filteredMedia = useMemo(() => {
    if (mediaScope === "all") return aiMediaItems;
    if (!avatarChats.length) return [];
    const sessionIds = new Set(avatarChats.map((chat) => chat.id));
    return aiMediaItems.filter((item) => item.aiSessionId && sessionIds.has(item.aiSessionId));
  }, [avatarChats, mediaScope]);

  useEffect(() => {
    setMediaScope("chat");
  }, [avatarId]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleProfileUpdate = async (data: ProfileData) => {
    setIsUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedUser = await patchMe({
        name: data.name.trim(),
        username: data.username.trim().replace(/^@/, ""),
      });
      updateAuthUser(updatedUser);
      setSuccessMessage("Profile updated.");
    } catch {
      setErrorMessage("Could not update profile.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarChange = async (file: File) => {
    setIsUploading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      const updatedUser = await patchMe({ avatar });
      updateAuthUser(updatedUser);
      setSuccessMessage("Avatar updated.");
    } catch {
      setErrorMessage("Could not update avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative flex flex-row w-full h-screen bg-bg-main overflow-hidden">
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-primary-glow blur-3xl pointer-events-none" />

      <AISidebar
        activeSection={mainSidebarMode}
        user={{
          name: authUser?.name ?? "User",
          username: authUser?.username ? `@${authUser.username}` : "@user",
          avatar: authUser?.avatar ?? "",
          phone: authUser?.phone ?? "",
        }}
        onLogout={() => {
          clearSession();
          navigate("/login", { replace: true });
        }}
        onOpenSettings={() => navigate("/settings")}
        onUpdateProfile={(data) => {
          void handleProfileUpdate(data);
        }}
        onAvatarChange={(file) => {
          void handleAvatarChange(file);
        }}
        isUpdating={isUpdating}
        isUploading={isUploading}
        errorMessage={errorMessage}
        successMessage={successMessage}
        onHomeClick={() => goHomeWithTransition(navigate)}
        onOpenChats={() => navigate("/chat")}
        onOpenGroups={() => navigate("/groups")}
        credits={120}
        onBuyCredits={() => navigate("/credits")}
        aiChats={avatarChats}
        media={filteredMedia}
        mediaScope={mediaScope}
        onMediaScopeChange={setMediaScope}
        canSelectThisChat={Boolean(avatarId)}
        selectedAvatarId={avatarId}
        onSelectSection={(section) => {
          if (section === "settings") {
            navigate("/settings");
            return;
          }
          setMainSidebarMode(section);
        }}
        onSelectAvatar={(id) => navigate(`/ai/avatar/${id}`)}
        onRequestAvatar={async (payload) => {
          await createAvatarRequest(payload);
        }}
        unreadBadges={{
          direct: unreadSummary.direct,
          group: unreadSummary.group,
          ai: unreadSummary.ai,
        }}
      />

      <div className="relative z-10 flex flex-1 justify-center items-center">
        <div className="w-full h-full">
          <div className="h-full w-full rounded-2xl bg-bg-surface border border-border-subtle shadow-sm">
            {avatar ? (
              <AiAvatarChatContainer avatar={avatar} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-text-muted">
                No avatar for now.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
