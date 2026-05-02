import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { AISidebar } from "../sidebars/AISidebar"
import AiChatContainer from "../containers/AIChatContainer"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"
import { aiAvatarChats } from "../components/sidebarComponents/aiAvatarChats"
import type { SidebarSection } from "../components/sidebarComponents/ThinSidebar"
import { aiMediaItems, type MediaScope } from "../components/sidebarComponents/media";
import { useAuthStore } from "../stores/authStore";
import { toChatListItem, useChatStore } from "../stores/chatStore";
import { patchMe } from "../api/user.api";
import type { ProfileData } from "../components/profileComponents/ProfileAccountCard";
import {
  clearPendingAiDraft,
  deleteAiSession,
  getAiSessions,
  setPendingAiDraft,
  renameAiSession,
  togglePinAiSession,
} from "../utils/aiSessionStorage";
import { v4 as uuid } from "uuid";
import type { AiChatHistoryItem } from "../components/sidebarComponents/AiChatHistoryList";
import { sendMessage } from "../api/message.api";
import { fetchChats } from "../api/chat.api";
import { createAvatarRequest } from "../api/settings.api";
import { slidePanelVariant } from "../lib/motionVariants";
import { goHomeWithTransition } from "../lib/navigation";

const sortAiChats = (items: AiChatHistoryItem[]) =>
  [...items].sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bUpdated - aUpdated;
  });

export default function AiChatPage() {
  const navigate = useNavigate()
  const { state, pathname } = useLocation()
  const { chatId } = useParams<{ chatId?: string }>();
  const routeState =
    (state as { initialMessage?: string; autoSend?: boolean; activeSection?: SidebarSection } | null) ??
    null;
  const authUser = useAuthStore((store) => store.user);
  const token = useAuthStore((store) => store.token);
  const updateAuthUser = useAuthStore((store) => store.updateUser);
  const clearSession = useAuthStore((store) => store.clearSession);
  const unreadSummary = useChatStore((store) => store.unreadSummary);
  const chats = useChatStore((store) => store.chats);
  const setChats = useChatStore((store) => store.setChats);
  const [mainSidebarMode, setMainSidebarMode] = useState<SidebarSection>(
    routeState?.activeSection ?? "chats"
  )
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [mediaScope, setMediaScope] = useState<MediaScope>("chat");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [shareInAppTarget, setShareInAppTarget] = useState<AiChatHistoryItem | null>(null);
  const [isSharePickerOpen, setIsSharePickerOpen] = useState(false);
  const [isLoadingShareTargets, setIsLoadingShareTargets] = useState(false);
  const [sendingShareToChatId, setSendingShareToChatId] = useState<string | null>(null);
  const [shareError, setShareError] = useState("");
  const [renameTarget, setRenameTarget] = useState<AiChatHistoryItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AiChatHistoryItem | null>(null);
  const [isDeletingAiChat, setIsDeletingAiChat] = useState(false);
  const mapSessionToItem = (session: ReturnType<typeof getAiSessions>[number]): AiChatHistoryItem => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    pinned: Boolean(session.pinned),
  });

  const [aiChats, setAiChats] = useState(() => sortAiChats(getAiSessions().map(mapSessionToItem)));

  const selectedAiSessionId = chatId ?? null;

  const safeNavigate = (targetPath: string) => {
    navigate(targetPath);
    window.setTimeout(() => {
      if (window.location.pathname === pathname) {
        window.location.assign(targetPath);
      }
    }, 120);
  };

  const handleCreateChatFromDraft = useCallback(
    (initialDraftMessage: string) => {
      const nextId = uuid();
      setPendingAiDraft(nextId, initialDraftMessage);
      navigate(`/ai/${nextId}`, {
        state: { initialMessage: initialDraftMessage, autoSend: true },
      });
    },
    [navigate]
  );

  const handleSessionMetaChange = useCallback(
    (meta: { id: string; title: string; updatedAt: string }) => {
      setAiChats((prev) => {
        const existing = prev.find((item) => item.id === meta.id);
        if (
          existing &&
          existing.title === meta.title &&
          existing.updatedAt === meta.updatedAt
        ) {
          return prev;
        }
        const pinned = existing?.pinned ?? false;
        return sortAiChats([{ ...meta, pinned }, ...prev.filter((item) => item.id !== meta.id)]);
      });
    },
    []
  );

  const refreshAiChats = useCallback(() => {
    setAiChats(sortAiChats(getAiSessions().map(mapSessionToItem)));
  }, []);

  const handleShareAiChatInApp = useCallback((chat: AiChatHistoryItem) => {
    setShareInAppTarget(chat);
    setShareError("");
    setIsSharePickerOpen(true);
  }, []);

  const handleShareAiChatOutside = useCallback(async (chat: AiChatHistoryItem) => {
    const shareUrl = `${window.location.origin}/ai/${chat.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: chat.title || "AI Chat",
          text: chat.title || "AI Chat",
          url: shareUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(shareUrl);
  }, []);

  const shareTargets = useMemo(
    () =>
      chats
        .filter((chat) => chat.type !== "AI")
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chats]
  );

  useEffect(() => {
    if (!isSharePickerOpen) return;
    let alive = true;
    setIsLoadingShareTargets(true);
    setShareError("");
    void fetchChats()
      .then((data) => {
        if (!alive) return;
        setChats(data);
      })
      .catch(() => {
        if (!alive) return;
        setShareError("Could not load chats.");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoadingShareTargets(false);
      });
    return () => {
      alive = false;
    };
  }, [isSharePickerOpen, setChats]);

  const handleShareToChat = useCallback(async (targetChatId: string) => {
    if (!shareInAppTarget || !targetChatId) return;
    const shareUrl = `${window.location.origin}/ai/${shareInAppTarget.id}`;
    const text = `${shareInAppTarget.title || "AI Chat"}\n${shareUrl}`;
    setSendingShareToChatId(targetChatId);
    setShareError("");
    try {
      await sendMessage({
        chatId: targetChatId,
        type: "TEXT",
        content: text,
      });
      setIsSharePickerOpen(false);
      setShareInAppTarget(null);
    } catch {
      setShareError("Could not share to this chat.");
    } finally {
      setSendingShareToChatId(null);
    }
  }, [shareInAppTarget]);

  const handleRenameAiChat = useCallback((chat: AiChatHistoryItem) => {
    setRenameTarget(chat);
    setRenameValue(chat.title || "New AI Chat");
  }, []);

  const handleConfirmRenameAiChat = useCallback(() => {
    if (!renameTarget) return;
    const nextTitle = renameValue.trim();
    const currentTitle = (renameTarget.title || "New AI Chat").trim();
    if (!nextTitle) return;
    if (nextTitle === currentTitle) {
      setRenameTarget(null);
      return;
    }
    renameAiSession(renameTarget.id, nextTitle);
    refreshAiChats();
    setRenameTarget(null);
  }, [refreshAiChats, renameTarget, renameValue]);

  const handlePinAiChat = useCallback((chat: AiChatHistoryItem) => {
    togglePinAiSession(chat.id);
    refreshAiChats();
  }, [refreshAiChats]);

  const handleDeleteAiChat = useCallback((chat: AiChatHistoryItem) => {
    setDeleteTarget(chat);
  }, []);

  const handleConfirmDeleteAiChat = useCallback(() => {
    if (!deleteTarget) return;
    setIsDeletingAiChat(true);
    try {
      clearPendingAiDraft(deleteTarget.id);
      deleteAiSession(deleteTarget.id);
      refreshAiChats();
      if (selectedAiSessionId === deleteTarget.id) {
        navigate("/ai");
      }
      setDeleteTarget(null);
    } finally {
      setIsDeletingAiChat(false);
    }
  }, [deleteTarget, navigate, refreshAiChats, selectedAiSessionId]);

  const handleCancelDeleteAiChat = useCallback(() => {
    if (isDeletingAiChat) return;
    setDeleteTarget(null);
  }, [isDeletingAiChat]);

  const handleCancelRenameAiChat = useCallback(() => {
    setRenameTarget(null);
    setRenameValue("");
  }, []);

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirmRenameAiChat();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelRenameAiChat();
    }
  };

  const avatarChats = useMemo(() => {
    if (!selectedAvatarId) return []
    return aiAvatarChats[selectedAvatarId] ?? []
  }, [selectedAvatarId])

  const filteredMedia = useMemo(() => {
    if (mediaScope === "all") return aiMediaItems;
    if (!selectedAiSessionId) return [];
    return aiMediaItems.filter((item) => item.aiSessionId === selectedAiSessionId);
  }, [mediaScope, selectedAiSessionId]);

  useEffect(() => {
    setMediaScope("chat");
  }, [selectedAiSessionId]);

  useEffect(() => {
    if (!pathname.startsWith("/ai/avatar/") && selectedAvatarId) {
      setSelectedAvatarId(null);
    }
  }, [pathname, selectedAvatarId]);

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
    <div className="relative flex flex-row w-full h-screen bg-[#020617] overflow-hidden">
      <div className="absolute -top-36 -left-28 w-[520px] h-[520px] bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-[460px] h-[460px] bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)] blur-3xl pointer-events-none" />

      {/* ======================= Sidebar ======================= */}
      <AISidebar
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
        onOpenChats={() => safeNavigate("/chat")}
        onOpenGroups={() => safeNavigate("/groups")}
        credits={authUser?.credits.remainingCredits ?? 0}
        onBuyCredits={() => navigate("/credits")}
        activeSection={mainSidebarMode}
        onSelectSection={setMainSidebarMode}
        aiChats={selectedAvatarId ? avatarChats : aiChats}
        media={filteredMedia}
        mediaScope={mediaScope}
        onMediaScopeChange={setMediaScope}
        canSelectThisChat={Boolean(selectedAiSessionId)}
        onRenameAiChat={handleRenameAiChat}
        onShareAiChatInApp={handleShareAiChatInApp}
        onShareAiChatOutside={handleShareAiChatOutside}
        onPinAiChat={handlePinAiChat}
        onDeleteAiChat={handleDeleteAiChat}
        selectedAiChatId={selectedAiSessionId}
        selectedAvatarId={selectedAvatarId}
        onSelectAvatar={(avatarId) => {
          setSelectedAvatarId(avatarId)
          setMainSidebarMode("chats")
          navigate(`/ai/avatar/${avatarId}`)
        }}
        onRequestAvatar={async (payload) => {
          await createAvatarRequest(payload);
        }}
        unreadBadges={{
          direct: unreadSummary.direct,
          group: unreadSummary.group,
          ai: unreadSummary.ai,
        }}
      />

      <div className="relative z-10 flex flex-1">
        <div className="w-full h-full">
          <div className="h-full w-full bg-[#020617]/90 border border-white/10 shadow-[0_30px_80px_-50px_rgba(6,182,212,0.6)] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedAiSessionId ?? "ai-draft"}
                variants={slidePanelVariant}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="h-full w-full"
              >
                <AiChatContainer
                  chatId={selectedAiSessionId ?? undefined}
                  initialMessage={routeState?.initialMessage}
                  autoSendInitial={Boolean(routeState?.autoSend)}
                  onCreateChatFromDraft={handleCreateChatFromDraft}
                  onSessionMetaChange={handleSessionMetaChange}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {isSharePickerOpen && shareInAppTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share AI chat in app</h3>
              <button
                type="button"
                onClick={() => {
                  setIsSharePickerOpen(false);
                  setShareInAppTarget(null);
                  setShareError("");
                }}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {shareInAppTarget.title || "AI Chat"}
            </div>
            {shareError && (
              <div className="mt-2 text-xs text-rose-300">{shareError}</div>
            )}

            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {isLoadingShareTargets && (
                <div className="text-sm text-zinc-300">Loading chats...</div>
              )}
              {!isLoadingShareTargets && shareTargets.length === 0 && (
                <div className="text-sm text-zinc-400">No chats or groups available.</div>
              )}
              {!isLoadingShareTargets &&
                shareTargets.map((target) => (
                  <button
                    key={`share-ai-target-${target.chatId}`}
                    type="button"
                    disabled={Boolean(sendingShareToChatId)}
                    onClick={() => {
                      void handleShareToChat(target.chatId);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60 disabled:opacity-60"
                  >
                    <div>
                      <div className="text-sm font-medium">{target.title}</div>
                      <div className="text-xs text-zinc-400">
                        {target.type === "GROUP" ? "Group" : `@${target.username}`}
                      </div>
                    </div>
                    <span className="text-xs text-indigo-300">
                      {sendingShareToChatId === target.chatId ? "Sending..." : "Share"}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-xl">
            <div className="text-lg font-semibold">Rename AI chat</div>
            <div className="mt-1 text-xs text-zinc-400">
              Update title for this conversation.
            </div>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={handleRenameKeyDown}
              maxLength={100}
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400"
              placeholder="Enter chat title"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelRenameAiChat}
                className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRenameAiChat}
                disabled={!renameValue.trim()}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-xl">
            <div className="text-lg font-semibold">Delete AI chat?</div>
            <div className="mt-1 text-xs text-zinc-400">
              This chat will be removed from your AI chat history.
            </div>
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200">
              {deleteTarget.title || "New AI Chat"}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDeleteAiChat}
                disabled={isDeletingAiChat}
                className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAiChat}
                disabled={isDeletingAiChat}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {isDeletingAiChat ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
