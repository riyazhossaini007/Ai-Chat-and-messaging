import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import GroupsSidebar from "../sidebars/GroupsSidebar";
import type { GroupCreatePayload } from "../components/sidebarComponents/GroupChatSetupModal";
import GroupChatContainer from "../containers/GroupChatContainer";
import type { SidebarSection } from "../components/sidebarComponents/ThinSidebar";
import type { MediaScope, SidebarMediaItem } from "../components/sidebarComponents/media";
import {
  createGroup,
  deleteGroup,
  fetchMyGroups,
  leaveGroup,
  postGroupMessage,
} from "../api/group.api";
import { getApiErrorCode, getApiErrorMessage } from "../api/api";
import { fetchChats } from "../api/chat.api";
import { fetchChatMedia } from "../api/media.api";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../stores/authStore";
import { toChatListItem, useChatStore } from "../stores/chatStore";
import type { GroupSummaryRecord } from "../api/types";
import type { GroupActionId } from "../components/sidebarComponents/GroupList";
import { slidePanelVariant } from "../lib/motionVariants";
import { goHomeWithTransition } from "../lib/navigation";

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

export default function GroupsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { groupId } = useParams<{ groupId?: string }>();
  const normalizedGroupId =
    groupId && groupId !== "undefined" && groupId !== "null" ? groupId : undefined;

  const authUser = useAuthStore((store) => store.user);
  const token = useAuthStore((store) => store.token);
  const clearSession = useAuthStore((store) => store.clearSession);

  const chats = useChatStore((store) => store.chats);
  const unreadSummary = useChatStore((store) => store.unreadSummary);
  const setChats = useChatStore((store) => store.setChats);
  const [groups, setGroups] = useState<GroupSummaryRecord[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mainSidebarMode, setMainSidebarMode] = useState<"groups" | "media">(
    (state as { activeSection?: SidebarSection } | null)?.activeSection === "media"
      ? "media"
      : "groups"
  );
  const [mediaScope, setMediaScope] = useState<MediaScope>("chat");
  const [media, setMedia] = useState<SidebarMediaItem[]>([]);

  const [pendingSharePayload, setPendingSharePayload] = useState<{
    content?: string;
    mediaUrl?: string;
    type?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  } | null>(
    (state as {
      sharePayload?: {
        content?: string;
        mediaUrl?: string;
        type?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
      };
    } | null)?.sharePayload ?? null
  );

  const refreshGroups = useCallback(async () => {
    try {
      const data = await fetchMyGroups();
      setGroups(data);
      setLoadError(null);
    } catch (error) {
      setGroups([]);
      setLoadError(getApiErrorMessage(error));
    } finally {
      setGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchChats()
      .then((data) => setChats(data))
      .catch((error) => setLoadError(getApiErrorMessage(error)));
  }, [setChats, token]);

  useEffect(() => {
    if (!token) return;
    void refreshGroups();
  }, [refreshGroups, token]);

  const selectedGroupId = normalizedGroupId ?? null;
  const groupItems = useMemo(() => {
    const mapped = groups.map((group) => {
      const liveGroupChat = chats.find(
        (chat) => chat.type === "GROUP" && chat.group?.id === group.id
      );
      const liveUnreadCount = liveGroupChat?.unreadCount;
      const liveGroup = liveGroupChat?.group;
      return {
        groupId: group.id,
        chatId: group.chatId,
        title: liveGroup?.title ?? group.title,
        avatar: liveGroup?.avatar ?? group.avatar,
        memberCount: group.memberCount,
        role: group.myRole,
        lastMessage: group.lastMessagePreview,
        lastMessageAt: liveGroup?.updatedAt ?? group.updatedAt,
        unseenCount: liveUnreadCount ?? group.unseenCount,
      };
    });

    if (!selectedGroupId) return mapped;
    const selectedIndex = mapped.findIndex((item) => item.groupId === selectedGroupId);
    if (selectedIndex <= 0) return mapped;
    const [selectedItem] = mapped.splice(selectedIndex, 1);
    mapped.unshift(selectedItem);
    return mapped;
  }, [chats, groups, selectedGroupId]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedGroupChatId = selectedGroup?.chatId ?? null;
  const shouldRecoverToGroups = Boolean(groupId && !normalizedGroupId);
  const isInvalidGroupId = Boolean(groupsLoaded && selectedGroupId && !selectedGroup);

  useEffect(() => {
    if (!selectedGroupChatId) {
      setMedia([]);
      return;
    }

    const run = async () => {
      const result = await fetchChatMedia(selectedGroupChatId, mediaScope);
      setMedia(toSidebarMediaItems(result));
    };

    void run();
  }, [mediaScope, selectedGroupChatId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selectedGroupChatId) return;

    const refresh = () => {
      void fetchChatMedia(selectedGroupChatId, mediaScope).then((result) => {
        setMedia(toSidebarMediaItems(result));
      });
    };

    const handleGroupMessage = (payload: {
      chatId: string;
      mediaUrl: string | null;
      type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    }) => {
      if (!payload.mediaUrl) return;
      if (mediaScope === "chat" && payload.chatId !== selectedGroupChatId) return;
      refresh();
    };

    socket.on("group:message_new", handleGroupMessage);
    return () => {
      socket.off("group:message_new", handleGroupMessage);
    };
  }, [mediaScope, selectedGroupChatId]);

  useEffect(() => {
    setMediaScope("chat");
  }, [selectedGroupChatId]);

  useEffect(() => {
    if (!selectedGroupId && mainSidebarMode === "media") {
      setMainSidebarMode("groups");
    }
  }, [mainSidebarMode, selectedGroupId]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (shouldRecoverToGroups) {
    return <Navigate to="/groups" replace />;
  }

  if (isInvalidGroupId) {
    return <Navigate to="/groups" replace />;
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#020617]">
      <div className="pointer-events-none absolute -top-36 -left-28 h-[520px] w-[520px] bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -right-24 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)] blur-3xl" />

      <div className="relative z-30 h-full overflow-visible">
        <GroupsSidebar
          groups={groupItems}
          activeSection={mainSidebarMode}
          activeGroupId={selectedGroupId ?? undefined}
          media={media}
          mediaScope={mediaScope}
          onMediaScopeChange={setMediaScope}
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
          onOpenChats={() => navigate("/chat", { state: { activeSection: "chats" } })}
          onHomeClick={() => goHomeWithTransition(navigate)}
          unreadBadges={{
            direct: unreadSummary.direct,
            group: unreadSummary.group,
            ai: unreadSummary.ai,
          }}
          onSelectSection={(section) => {
            setMainSidebarMode(section);
          }}
          onSelectGroup={(group) => navigate(`/groups/${group.groupId}`)}
          onGroupAction={(action: GroupActionId, group) => {
            if (
              action === "view-info" ||
              action === "edit-description" ||
              action === "edit-rules" ||
              action === "add-members" ||
              action === "remove-members" ||
              action === "invite-link" ||
              action === "revoke-invite" ||
              action === "assign-admin" ||
              action === "remove-admin"
            ) {
              navigate(`/groups/${group.groupId}`, { state: { openGroupInfo: true } });
              return;
            }
            if (action === "leave") {
              void leaveGroup(group.groupId)
                .then(() => {
                  void refreshGroups();
                  if (selectedGroupId === group.groupId) navigate("/groups");
                })
                .catch((error) => {
                  if (getApiErrorCode(error) === "CREATOR_MUST_ASSIGN_ADMIN") {
                    navigate(`/groups/${group.groupId}`, {
                      state: {
                        openLeaveModal: true,
                      },
                    });
                    return;
                  }
                  setLoadError(getApiErrorMessage(error));
                });
            }
            if (action === "delete-group") {
              void deleteGroup(group.groupId)
                .then(() => {
                  void refreshGroups();
                  if (selectedGroupId === group.groupId) navigate("/groups");
                })
                .catch((error) => setLoadError(getApiErrorMessage(error)));
            }
          }}
          groupUsers={chats
            .filter((chat) => chat.type === "DIRECT")
            .map((chat) => toChatListItem(chat, authUser?.id))
            .map((chat) => ({
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
            setLoadError(null);
            await refreshGroups();
            navigate(`/groups/${created.id}`);
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-1 items-stretch overflow-hidden">
        <div className="relative h-full w-full overflow-hidden border border-cyan-400/20 bg-[#020617]/88 shadow-[0_35px_90px_-55px_rgba(6,182,212,0.75)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          {loadError && (
            <div className="absolute inset-x-4 top-4 z-30 rounded-xl border border-semantic-error/40 bg-semantic-error/10 px-3 py-2 text-xs text-semantic-error">
              {loadError}
            </div>
          )}
          <AnimatePresence mode="wait">
            {selectedGroupId ? (
              <motion.div
                key={`group-${selectedGroupId}`}
                variants={slidePanelVariant}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="h-full w-full"
              >
                <GroupChatContainer groupId={selectedGroupId} />
              </motion.div>
            ) : (
              <motion.div
                key="group-empty"
                variants={slidePanelVariant}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative flex h-full w-full items-center justify-center overflow-hidden"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.14),transparent_45%),radial-gradient(circle_at_30%_80%,rgba(16,185,129,0.12),transparent_50%)]" />
                <div className="relative flex max-w-md flex-col items-center gap-4 rounded-3xl border border-cyan-400/20 bg-zinc-900/45 px-8 py-9 text-center shadow-[0_24px_70px_-40px_rgba(34,211,238,0.8)] backdrop-blur">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/30 to-emerald-300/20 text-lg font-bold text-cyan-100">
                    GR
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-white">Select a group to start</div>
                  <div className="max-w-xs text-sm text-zinc-300">
                    Choose a group from the sidebar to view the conversation.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {pendingSharePayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share to group</h3>
              <button
                type="button"
                onClick={() => setPendingSharePayload(null)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {groupItems.map((group) => (
                <button
                  key={`share-target-group-${group.groupId}`}
                  type="button"
                  onClick={() => {
                    void postGroupMessage(group.groupId, {
                      text: pendingSharePayload.content ?? "Shared message",
                    }).then(() => {
                      setPendingSharePayload(null);
                      navigate(`/groups/${group.groupId}`);
                    });
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">{group.title}</div>
                    <div className="text-xs text-zinc-400">Group</div>
                  </div>
                  <span className="text-xs text-indigo-300">Send</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
