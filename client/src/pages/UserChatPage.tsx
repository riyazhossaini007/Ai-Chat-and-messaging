import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { UserSidebar } from "../sidebars/UserSidebar";
import UserChatContainer from "../containers/UserChatContainer";
import type { GroupCreatePayload } from "../components/sidebarComponents/GroupChatSetupModal";
import type { SidebarSection } from "../components/sidebarComponents/ThinSidebar";
import type { MediaScope, SidebarMediaItem } from "../components/sidebarComponents/media";
import { createGroup } from "../api/group.api";
import { fetchChatMedia } from "../api/media.api";
import { deleteMessages } from "../api/message.api";
import {
  archiveChat as archiveChatApi,
  createOrGetPrivateChat,
  fetchChats,
  leaveChat,
  togglePinChat as togglePinChatApi,
  unarchiveChat as unarchiveChatApi,
} from "../api/chat.api";
import { getSocket } from "../lib/socket";
import type { NearbyUserRecord } from "../api/types";
import { useAuthStore } from "../stores/authStore";
import { toChatListItem, useChatStore } from "../stores/chatStore";
import { goHomeWithTransition } from "../lib/navigation";
import { slidePanelVariant } from "../lib/motionVariants";
import { shareMessage } from "../utils/shareMessage";

const toMediaType = (
  rawType: "TEXT" | "IMAGE" | "VIDEO" | "FILE"
): "image" | "video" | "file" => {
  if (rawType === "VIDEO") return "video";
  if (rawType === "FILE") return "file";
  return "image";
};

const toSidebarMediaItems = (
  items: Array<{
    id: string;
    content: string | null;
    type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    mediaUrl: string | null;
    chatId: string;
  }>
): SidebarMediaItem[] =>
  items
    .filter((item) => item.mediaUrl)
    .map((item) => ({
      id: item.id,
      title: item.content ?? item.type.toLowerCase(),
      type: toMediaType(item.type),
      previewUrl: item.mediaUrl!,
      fullUrl: item.mediaUrl!,
      chatId: item.chatId,
    }));

export default function ChatPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();

  const authUser = useAuthStore((store) => store.user);
  const token = useAuthStore((store) => store.token);
  const clearSession = useAuthStore((store) => store.clearSession);

  const chats = useChatStore((store) => store.chats);
  const nearbyUsers = useChatStore((store) => store.nearbyUsers);
  const setChats = useChatStore((store) => store.setChats);
  const loadNearbyUsers = useChatStore((store) => store.loadNearbyUsers);
  const upsertChat = useChatStore((store) => store.upsertChat);
  const removeNearbyUser = useChatStore((store) => store.removeNearbyUser);
  const applyParticipantState = useChatStore((store) => store.applyParticipantState);
  const unreadSummary = useChatStore((store) => store.unreadSummary);

  const [mainSidebarMode, setMainSidebarMode] = useState<SidebarSection>(
    (state as { activeSection?: SidebarSection } | null)?.activeSection ?? "chats"
  );
  const [mediaScope, setMediaScope] = useState<MediaScope>("chat");
  const [media, setMedia] = useState<SidebarMediaItem[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [isMediaCardOpen, setIsMediaCardOpen] = useState(false);
  const [mediaPreviewItem, setMediaPreviewItem] = useState<SidebarMediaItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<{
    chatId: string;
    title: string;
  } | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const closeMediaCard = () => {
    setIsMediaCardOpen(false);
    setSelectionMode(false);
    setSelectedMediaIds(new Set());
    setDeleteDialogOpen(false);
    setMediaPreviewItem(null);
  };

  const toggleSelection = (messageId: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  };

  const downloadOne = (item: SidebarMediaItem) => {
    const href = item.fullUrl ?? item.previewUrl;
    if (!href) return;
    const link = document.createElement("a");
    link.href = href;
    link.download = item.title || `media-${item.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSelected = async () => {
    const items = media.filter((item) => selectedMediaIds.has(item.id));
    for (const item of items) {
      downloadOne(item);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
  };

  const shareItems = async (items: SidebarMediaItem[]) => {
    if (items.length === 0) return;
    const text = items
      .map((item) => item.fullUrl ?? item.previewUrl)
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: items.length === 1 ? items[0].title : "Shared media",
          text,
        });
        return;
      } catch {
        // If user cancels share panel, do nothing.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be blocked in some browsers.
    }
  };

  const deleteSelected = async () => {
    if (selectedMediaIds.size === 0 || !selectedChatId) return;
    await deleteMessages({
      messageIds: Array.from(selectedMediaIds),
      scope: "ME",
    });

    const result = await fetchChatMedia(selectedChatId, mediaScope);
    setMedia(toSidebarMediaItems(result));

    setDeleteDialogOpen(false);
    setSelectionMode(false);
    setSelectedMediaIds(new Set());
    setMediaPreviewItem(null);
  };

  useEffect(() => {
    if (!token) return;

    const run = async () => {
      const data = await fetchChats();
      setChats(data);
      setChatsLoaded(true);
    };

    void run();
  }, [setChats, token]);

  useEffect(() => {
    if (!token) return;
    if (chats.length > 0) return;
    void loadNearbyUsers();
  }, [chats.length, loadNearbyUsers, token]);

  const chatItems = useMemo(
    () =>
      chats
        .filter((chat) => chat.type === "DIRECT")
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chats]
  );

  const groups = useMemo(
    () =>
      chats
        .filter((chat) => chat.type === "GROUP")
        .map((chat) => ({
          ...toChatListItem(chat, authUser?.id),
          role: "owner" as const,
        })),
    [authUser?.id, chats]
  );

  const selectedChat = useMemo(() => {
    if (!chatId) return null;

    const byId = chatItems.find((chat) => chat.chatId === chatId);
    if (byId) return byId;

    const normalized = decodeURIComponent(chatId).replace(/^@/, "").toLowerCase();
    return chatItems.find((chat) => chat.username.toLowerCase() === normalized) ?? null;
  }, [chatId, chatItems]);

  const selectedChatId = selectedChat?.chatId ?? null;

  const handleShareChat = async (targetChatId: string) => {
    const target = chatItems.find((chat) => chat.chatId === targetChatId);
    if (!target) return;
    const shareUrl = `${window.location.origin}/chat/${encodeURIComponent(target.chatId)}`;
    const shareText = [target.title, `@${target.username}`, shareUrl].filter(Boolean).join("\n");
    await shareMessage({
      title: target.title || "Chat",
      text: shareText,
      url: shareUrl,
    });
  };

  const handleDeleteChat = async (targetChatId: string) => {
    const target = chatItems.find((chat) => chat.chatId === targetChatId);
    if (!target) return;
    setPendingDeleteChat({
      chatId: target.chatId,
      title: target.title || "this user",
    });
  };

  const handleConfirmDeleteChat = async () => {
    if (!pendingDeleteChat) return;
    setIsDeletingChat(true);
    try {
      await leaveChat(pendingDeleteChat.chatId);
      const nextChats = await fetchChats();
      setChats(nextChats);
      if (selectedChatId === pendingDeleteChat.chatId) {
        navigate("/chat", { replace: true });
      }
      setPendingDeleteChat(null);
    } catch (error) {
      console.error("Failed to delete chat", error);
    } finally {
      setIsDeletingChat(false);
    }
  };

  const handleSelectNearbyUser = async (user: NearbyUserRecord) => {
    try {
      const chat = await createOrGetPrivateChat({ userId: user.id });
      upsertChat(chat);
      removeNearbyUser(user.id);
      setMainSidebarMode("chats");
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      console.error("Failed to create private chat", error);
    }
  };

  useEffect(() => {
    if (!selectedChatId) {
      setMedia([]);
      return;
    }

    const run = async () => {
      const result = await fetchChatMedia(selectedChatId, mediaScope);
      setMedia(toSidebarMediaItems(result));
    };

    void run();
  }, [mediaScope, selectedChatId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selectedChatId) return;

    const handleNewMessage = (payload: {
      id: string;
      chatId: string;
      senderId: string | null;
      content: string | null;
      mediaUrl: string | null;
      type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
      createdAt: string;
      status: "SENT" | "DELIVERED" | "READ";
    }) => {
      if (!payload.mediaUrl) return;
      if (mediaScope === "chat" && payload.chatId !== selectedChatId) return;

      void fetchChatMedia(selectedChatId, mediaScope).then((result) => {
        setMedia(toSidebarMediaItems(result));
      });
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [mediaScope, selectedChatId]);

  useEffect(() => {
    setMediaScope("chat");
    closeMediaCard();
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId && mainSidebarMode === "media") {
      setMainSidebarMode("chats");
    }
  }, [selectedChatId, mainSidebarMode]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const isInvalidChatId = Boolean(chatsLoaded && chatId && !selectedChat);
  if (isInvalidChatId) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#020617]">
      <div className="pointer-events-none absolute -top-36 -left-28 h-[520px] w-[520px] bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -right-24 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)] blur-3xl" />

      <div className="relative z-20 h-full overflow-hidden">
        <UserSidebar
          chats={chatItems}
          nearbyUsers={nearbyUsers}
          media={media}
          groups={groups}
          activeSection={mainSidebarMode}
          users={[]}
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
          credits={120}
          onBuyCredits={() => navigate("/credits")}
          onOpenAiChat={() => navigate("/ai")}
          onHomeClick={() => goHomeWithTransition(navigate)}
          mediaScope={mediaScope}
          onMediaScopeChange={setMediaScope}
          canSelectThisChat={Boolean(selectedChatId)}
          showMediaSection={Boolean(selectedChatId)}
          onOpenMediaManager={() => {
            if (!selectedChatId) return;
            setIsMediaCardOpen(true);
          }}
          onShareChat={(activeChatId) => {
            void handleShareChat(activeChatId);
          }}
          onDeleteChat={(activeChatId) => {
            void handleDeleteChat(activeChatId);
          }}
          onSelectNearbyUser={(user) => {
            void handleSelectNearbyUser(user);
          }}
          onPinChat={(activeChatId) => {
            const current = chats.find((chat) => chat.id === activeChatId)?.viewerParticipant ?? null;
            const rollback = {
              pinned: current?.pinned ?? false,
              pinnedAt: current?.pinnedAt ?? null,
              archived: current?.archived ?? false,
              archivedAt: current?.archivedAt ?? null,
              customOrder: current?.customOrder ?? null,
            };
            applyParticipantState(activeChatId, {
              pinned: !rollback.pinned,
              pinnedAt: !rollback.pinned ? new Date().toISOString() : null,
            });
            void togglePinChatApi(activeChatId)
              .then((state) => {
                applyParticipantState(activeChatId, {
                  pinned: state.pinned,
                  pinnedAt: state.pinnedAt,
                  archived: state.archived,
                  archivedAt: state.archivedAt,
                  customOrder: state.customOrder,
                });
              })
              .catch((error) => {
                console.error("Failed to toggle pin", error);
                applyParticipantState(activeChatId, rollback);
              });
          }}
          onArchiveChat={(activeChatId) => {
            const current = chats.find((chat) => chat.id === activeChatId)?.viewerParticipant ?? null;
            const rollback = {
              pinned: current?.pinned ?? false,
              pinnedAt: current?.pinnedAt ?? null,
              archived: current?.archived ?? false,
              archivedAt: current?.archivedAt ?? null,
              customOrder: current?.customOrder ?? null,
            };
            applyParticipantState(activeChatId, {
              archived: true,
              archivedAt: new Date().toISOString(),
              pinned: false,
              pinnedAt: null,
            });
            void archiveChatApi(activeChatId)
              .then((state) => {
                applyParticipantState(activeChatId, {
                  pinned: state.pinned,
                  pinnedAt: state.pinnedAt,
                  archived: state.archived,
                  archivedAt: state.archivedAt,
                  customOrder: state.customOrder,
                });
              })
              .catch((error) => {
                console.error("Failed to archive chat", error);
                applyParticipantState(activeChatId, rollback);
              });
          }}
          onUnarchiveChat={(activeChatId) => {
            const current = chats.find((chat) => chat.id === activeChatId)?.viewerParticipant ?? null;
            const rollback = {
              pinned: current?.pinned ?? false,
              pinnedAt: current?.pinnedAt ?? null,
              archived: current?.archived ?? false,
              archivedAt: current?.archivedAt ?? null,
              customOrder: current?.customOrder ?? null,
            };
            applyParticipantState(activeChatId, {
              archived: false,
              archivedAt: null,
            });
            void unarchiveChatApi(activeChatId)
              .then((state) => {
                applyParticipantState(activeChatId, {
                  pinned: state.pinned,
                  pinnedAt: state.pinnedAt,
                  archived: state.archived,
                  archivedAt: state.archivedAt,
                  customOrder: state.customOrder,
                });
              })
              .catch((error) => {
                console.error("Failed to unarchive chat", error);
                applyParticipantState(activeChatId, rollback);
              });
          }}
          unreadBadges={{
            direct: unreadSummary.direct,
            group: unreadSummary.group,
            ai: unreadSummary.ai,
          }}
          onSelectSection={(section) => {
            if (section === "media" && !selectedChatId) return;
            if (section === "groups") {
              navigate("/groups");
              return;
            }
            if (section === "settings") {
              navigate("/settings");
              return;
            }
            setMainSidebarMode(section);
          }}
          groupUsers={chatItems.map((chat) => ({
            id: chat.peerUserId ?? chat.chatId,
            name: chat.title,
            username: `@${chat.username}`,
            avatar: chat.avatar,
          }))}
          onCreateGroup={async (data: GroupCreatePayload) => {
            const created = await createGroup({
              title: data.name,
              memberIds: data.members,
            });
            const nextChats = await fetchChats();
            setChats(nextChats);
            navigate(`/groups/${created.id}`);
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-1 items-stretch">
        <div className="relative h-full w-full overflow-hidden border border-cyan-400/25 bg-[#020617]/88 shadow-[0_35px_90px_-55px_rgba(6,182,212,0.75)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <AnimatePresence mode="wait">
            {selectedChatId ? (
              <motion.div
                key={`chat-${selectedChatId}`}
                variants={slidePanelVariant}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="h-full w-full"
              >
                <UserChatContainer initialMessage={(state as { initialMessage?: string } | null)?.initialMessage} />
              </motion.div>
            ) : (
              <motion.div
                key="chat-empty"
                variants={slidePanelVariant}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative flex h-full w-full items-center justify-center overflow-hidden"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.14),transparent_45%),radial-gradient(circle_at_30%_80%,rgba(16,185,129,0.12),transparent_50%)]" />
                <div className="relative mx-6 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-cyan-400/20 bg-zinc-900/45 px-8 py-9 text-center shadow-[0_24px_70px_-40px_rgba(34,211,238,0.8)] backdrop-blur">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/30 to-emerald-300/20 text-lg font-bold text-cyan-100">
                    DM
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-white">
                    Select a chat to start messaging
                  </div>
                  <div className="max-w-xs text-sm text-zinc-300">
                    Choose a user or group from the sidebar to view the conversation.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isMediaCardOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
            onClick={closeMediaCard}
          >
            <div
              className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#030712]/95 shadow-[0_45px_120px_-65px_rgba(6,182,212,0.95)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-cyan-400/20 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-white">View All Media</div>
                  {selectionMode && (
                    <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-100">
                      {selectedMediaIds.size} selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectionMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void shareItems(media.filter((item) => selectedMediaIds.has(item.id)));
                        }}
                        disabled={selectedMediaIds.size === 0}
                        className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-100 hover:border-cyan-300/50 disabled:opacity-40"
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void downloadSelected();
                        }}
                        disabled={selectedMediaIds.size === 0}
                        className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-100 hover:border-cyan-300/50 disabled:opacity-40"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={selectedMediaIds.size === 0}
                        className="rounded-lg border border-rose-500/35 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-400/60 disabled:opacity-40"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedMediaIds(new Set());
                        }}
                        className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-300/50 hover:text-white"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectionMode(true)}
                      className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-300/50 hover:text-white"
                    >
                      Select
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeMediaCard}
                    className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-300/50 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {media.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-cyan-400/25 text-sm text-zinc-400">
                    No media yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {media.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (selectionMode) {
                            toggleSelection(item.id);
                            return;
                          }
                          setMediaPreviewItem(item);
                        }}
                        className={`group relative overflow-hidden rounded-xl border bg-zinc-900/70 text-left ${
                          selectedMediaIds.has(item.id)
                            ? "border-cyan-300 ring-2 ring-cyan-300/35"
                            : "border-cyan-400/20"
                        }`}
                      >
                        {selectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedMediaIds.has(item.id)}
                            readOnly
                            className="absolute left-2 top-2 z-10 h-4 w-4 accent-cyan-400"
                          />
                        )}
                        {item.type === "image" ? (
                          <img
                            src={item.previewUrl}
                            alt={item.title}
                            className="h-36 w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : item.type === "video" ? (
                          <video
                            src={item.previewUrl}
                            muted
                            playsInline
                            className="h-36 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center bg-zinc-900 text-xs text-zinc-300">
                            FILE
                          </div>
                        )}
                        <div className="p-2.5">
                          <div className="truncate text-xs text-zinc-100">{item.title}</div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-400">{item.type}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {mediaPreviewItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4"
            onClick={() => setMediaPreviewItem(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#030712]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-cyan-400/20 px-4 py-3">
                <div className="truncate text-sm text-white">{mediaPreviewItem.title}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void shareItems([mediaPreviewItem]);
                    }}
                    className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-100 hover:border-cyan-300/50"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadOne(mediaPreviewItem)}
                    className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-100 hover:border-cyan-300/50"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode(true);
                      setSelectedMediaIds(new Set([mediaPreviewItem.id]));
                      setMediaPreviewItem(null);
                      setDeleteDialogOpen(true);
                    }}
                    className="rounded-lg border border-rose-500/35 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-400/60"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaPreviewItem(null)}
                    className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-300/50 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="bg-black">
                {mediaPreviewItem.type === "image" ? (
                  <img
                    src={mediaPreviewItem.fullUrl ?? mediaPreviewItem.previewUrl}
                    alt={mediaPreviewItem.title}
                    className="max-h-[80vh] w-full object-contain"
                  />
                ) : mediaPreviewItem.type === "video" ? (
                  <video
                    src={mediaPreviewItem.fullUrl ?? mediaPreviewItem.previewUrl}
                    controls
                    autoPlay
                    className="max-h-[80vh] w-full"
                  />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center p-6">
                    <a
                      href={mediaPreviewItem.fullUrl ?? mediaPreviewItem.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-cyan-400/30 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                    >
                      Open file
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {deleteDialogOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4"
            onClick={() => setDeleteDialogOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-[#030712] p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-sm font-semibold text-white">Delete media</div>
              <div className="mt-1 text-xs text-zinc-400">
                {selectedMediaIds.size} selected
              </div>
              <button
                type="button"
                onClick={() => {
                  void deleteSelected();
                }}
                className="mt-4 w-full rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:border-rose-400/60"
              >
                Delete for me
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="mt-2 w-full rounded-lg border border-cyan-300/25 px-3 py-2 text-sm text-zinc-200 hover:border-cyan-300/50"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

      {pendingDeleteChat &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[145] flex items-center justify-center bg-black/75 p-4"
            onClick={() => {
              if (isDeletingChat) return;
              setPendingDeleteChat(null);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-[#030712] p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-sm font-semibold text-white">Delete chat?</div>
              <div className="mt-1 text-xs text-zinc-400">
                Chat with {pendingDeleteChat.title} will be removed from your chat list.
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmDeleteChat();
                }}
                disabled={isDeletingChat}
                className="mt-4 w-full rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:border-rose-400/60 disabled:opacity-50"
              >
                {isDeletingChat ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteChat(null)}
                disabled={isDeletingChat}
                className="mt-2 w-full rounded-lg border border-cyan-300/25 px-3 py-2 text-sm text-zinc-200 hover:border-cyan-300/50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
