import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import GroupMessageBubble, { type GroupMessage } from "../../components/chatComponents/GroupMessageBubble";
import ChatComposer, { type ChatComposerPayload } from "../../components/chatComponents/ChatComposer";
import AiPanel from "../../components/chatComponents/AiPanel";
import MediaViewerModal from "../../components/chatComponents/MediaViewerModal";
import DateSeparator from "../../components/chat/DateSeparator";
import { getDateSeparatorLabel, getMessageDayKey } from "../../components/chat/dateSeparatorUtils";
import { useChatAutoScroll } from "../../components/chatComponents/useChatAutoScroll";
import GroupInfoPanel from "../../components/group/GroupInfoPanel";
import {
  addGroupMembers,
  createGroupInvite,
  deleteGroup,
  fetchMessageReads,
  leaveGroup,
  patchGroup,
  patchGroupRules,
  postGroupMessage,
  removeGroupMember,
  revokeGroupInvite,
  setGroupAdminRole,
} from "../../api/group.api";
import { getApiErrorCode, getApiErrorMessage } from "../../api/api";
import { useAuthStore } from "../../stores/authStore";
import {
  deleteMessages,
  forwardMessages as forwardMessagesApi,
  sendMessage,
  toggleMessageReaction,
} from "../../api/message.api";
import { shareMessage } from "../../utils/shareMessage";
import { fetchChats } from "../../api/chat.api";
import { toChatListItem, useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAiThreadStore } from "../../stores/aiThreadStore";
import {
  layoutTransition,
  messageReceiveVariant,
  messageSendVariant,
  optimizedMotionStyle,
} from "../../lib/motionVariants";
import GroupChatHeader from "./components/GroupChatHeader";
import GroupChatOverlays from "./components/GroupChatOverlays";
import { useGroupChatData } from "./hooks/useGroupChatData";
import { useGroupIntelligence } from "../../hooks/useGroupIntelligence";
import { useKnowledgeActions } from "../../hooks/useKnowledgeActions";
import {
  fileToDataUrl,
  normalizeGroupMessage,
  toContentType,
  toGroupMessageType,
  type GroupClientMessage,
} from "./groupChat.utils";

type GroupChatContainerProps = {
  groupId: string;
};

export default function GroupChatContainer({ groupId }: GroupChatContainerProps) {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthStore((store) => store.user);
  const settings = useSettingsStore((store) => store.settings);
  const loadSettings = useSettingsStore((store) => store.loadSettings);
  const chats = useChatStore((store) => store.chats);
  const setChats = useChatStore((store) => store.setChats);
  const resetUnreadForChat = useChatStore((store) => store.resetUnreadForChat);
  const enterToSend = settings?.chat.enterToSend ?? true;
  const autoDownloadMedia = settings?.chat.autoDownload ?? true;
  const openAiPanel = useAiThreadStore((state) => state.openPanel);
  const clearAiForChatSwitch = useAiThreadStore((state) => state.clearForChatSwitch);
  const {
    group,
    messages,
    setMessages,
    refreshGroup,
    jumpToMessage,
    rememberHiddenMessages,
    messageRefs,
    highlightedMessageId,
    accessDenied,
    loadError,
  } = useGroupChatData({
    groupId,
    authUserId: authUser?.id ?? undefined,
    resetUnreadForChat,
  });

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [seenByMessageId, setSeenByMessageId] = useState<string | null>(null);
  const [seenByItems, setSeenByItems] = useState<
    Array<{ userId: string; username: string; avatar: string | null; readAt: string }>
  >([]);
  const [seenByLoading, setSeenByLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    content: string;
    mediaUrl?: string;
  } | null>(null);
  const [starredMessageIds, setStarredMessageIds] = useState<Record<string, true>>({});
  const [shareTarget, setShareTarget] = useState<{ messageId: string } | null>(null);
  const [selectionIntent, setSelectionIntent] = useState<"delete" | "forward" | null>(null);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Record<string, true>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [pendingForwardMessageIds, setPendingForwardMessageIds] = useState<string[]>([]);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<Record<string, true>>({});
  const [isForwarding, setIsForwarding] = useState(false);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    type: "IMAGE" | "VIDEO";
    url: string;
    caption?: string;
    messageId: string;
  } | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedNewAdminId, setSelectedNewAdminId] = useState<string>("");
  const [leaveActionError, setLeaveActionError] = useState<string | null>(null);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const didInitialScrollRef = useRef(false);
  const previousMessageIdsRef = useRef<string[]>([]);
  const consumedRouteLeaveRef = useRef(false);
  const { isAtBottom, unseenCount, scrollToBottom, onNewMessage, onPrependMessages } =
    useChatAutoScroll({
      containerRef: messageViewportRef,
      deps: [messages],
      threshold: 96,
    });
  const groupIntelligence = useGroupIntelligence(groupId, showInfoPanel, 5);
  const knowledgeActions = useKnowledgeActions();

  useEffect(() => {
    if (settings) return;
    void loadSettings();
  }, [loadSettings, settings]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    previousMessageIdsRef.current = [];
  }, [clearAiForChatSwitch, group?.chatId, groupId]);

  useEffect(() => {
    setOpenMenuMessageId(null);
    setViewer(null);
    consumedRouteLeaveRef.current = false;
    if (group?.chatId) {
      clearAiForChatSwitch(group.chatId);
    }
  }, [groupId]);

  useEffect(() => {
    const state = location.state as { openGroupInfo?: boolean; openLeaveModal?: boolean } | null;
    if (!state?.openGroupInfo) return;
    setShowInfoPanel(true);
  }, [groupId, location.state]);

  useEffect(() => {
    const currentIds = messages.map((message) => message.id);
    const previousIds = previousMessageIdsRef.current;

    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      scrollToBottom({ behavior: "auto" });
      previousMessageIdsRef.current = currentIds;
      return;
    }

    if (previousIds.length > 0 && currentIds.length > previousIds.length) {
      const previousFirstId = previousIds[0];
      const previousLastId = previousIds[previousIds.length - 1];
      const indexOfPreviousFirst = currentIds.indexOf(previousFirstId);
      const prependOnly =
        indexOfPreviousFirst > 0 && currentIds[currentIds.length - 1] === previousLastId;

      if (prependOnly) {
        onPrependMessages();
        previousMessageIdsRef.current = currentIds;
        return;
      }

      const appendOnly = previousIds.every((id, index) => currentIds[index] === id);
      if (appendOnly) {
        const addedMessages = messages.slice(previousIds.length);
        addedMessages.forEach((message) => {
          const isOutgoing =
            message.senderId === authUser?.id || message.localStatus === "SENDING";
          if (isOutgoing) {
            onNewMessage("outgoing");
            return;
          }
          if (message.kind === "SYSTEM") {
            onNewMessage("system");
            return;
          }
          onNewMessage("incoming");
        });
      }
    }

    previousMessageIdsRef.current = currentIds;
  }, [authUser?.id, messages, onNewMessage, onPrependMessages, scrollToBottom]);

  const roleLabel =
    group?.myRole === "CREATOR"
      ? "You are Creator"
      : group?.myRole === "ADMIN"
      ? "You are Admin"
      : null;
  const isMember = Boolean(group) && !accessDenied;

  const mappedMessages = useMemo<GroupMessage[]>(() => {
    return messages.map((message) => ({
      id: message.id,
      localId: message.localId,
      senderId: message.senderId,
      senderName:
        message.kind === "SYSTEM"
          ? message.systemActor?.name ??
            message.systemActor?.username ??
            message.sender?.name ??
            message.sender?.username ??
            "System"
          : message.sender?.name ??
            message.sender?.username ??
            message.systemActor?.name ??
            message.systemActor?.username ??
            "Member",
      senderAvatar: message.sender?.avatar ?? undefined,
      kind: message.kind,
      systemEvent: message.systemEvent,
      contentType: toContentType(message.type),
      content: message.content ?? "",
      mediaUrl: message.mediaUrl ?? undefined,
      replyToId: message.replyToId ?? undefined,
      replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            senderName: message.replyTo.sender.name,
            content: message.replyTo.deletedForEveryone
              ? "This message was deleted"
              : message.replyTo.content ?? "",
            mediaUrl: message.replyTo.mediaUrl ?? undefined,
            messageType: message.replyTo.type,
            deletedForEveryone: message.replyTo.deletedForEveryone,
          }
        : message.replyToPreview
        ? {
            id: message.replyToPreview.id,
            senderName: message.replyToPreview.senderUsername,
            content: message.replyToPreview.textSnippet,
            messageType: message.replyToPreview.mediaType ?? "TEXT",
            deletedForEveryone: Boolean(message.replyToPreview.isDeletedForEveryone),
          }
        : null,
      createdAt: message.createdAt,
      isMine: message.senderId === authUser?.id,
      readCount: message.readCount ?? 0,
      deliveredToAtLeastOne: Boolean(message.deliveredToAtLeastOne),
      localStatus: message.localStatus,
      chatType: "GROUP",
      starred: Boolean(starredMessageIds[message.id]),
      reactionSummary: message.reactionSummary ?? [],
    }));
  }, [authUser?.id, messages, starredMessageIds]);

  const renderedMessageItems = useMemo(() => {
    const items: Array<
      | { kind: "separator"; key: string; label: string }
      | { kind: "message"; message: GroupMessage; previousSenderId: string | null }
    > = [];
    let previousDayKey: string | null = null;
    let previousMessageSenderId: string | null = null;

    mappedMessages.forEach((message) => {
      const currentDayKey = getMessageDayKey(message.createdAt);
      if (currentDayKey !== previousDayKey) {
        items.push({
          kind: "separator",
          key: `sep-${currentDayKey}`,
          label: getDateSeparatorLabel(message.createdAt),
        });
        previousDayKey = currentDayKey;
      }
      items.push({
        kind: "message",
        message,
        previousSenderId: previousMessageSenderId,
      });
      previousMessageSenderId = message.senderId;
    });

    return items;
  }, [mappedMessages]);

  const applyReactionSummary = useCallback(
    (
      messageId: string,
      summary: Array<{ emoji: string; count: number; reactedByMe: boolean }>
    ) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                reactionSummary: summary.filter((item) => item.count > 0),
              }
            : message
        )
      );
    },
    []
  );

  const applyOptimisticReactionToggle = useCallback(
    (messageId: string, emoji: string) => {
      let optimistic: Array<{ emoji: string; count: number; reactedByMe: boolean }> = [];
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) return message;
          const existing = message.reactionSummary ?? [];
          const found = existing.find((item) => item.emoji === emoji);

          if (found?.reactedByMe) {
            optimistic = existing
              .map((item) =>
                item.emoji === emoji
                  ? {
                      ...item,
                      count: Math.max(0, item.count - 1),
                      reactedByMe: false,
                    }
                  : item
              )
              .filter((item) => item.count > 0);
          } else if (found) {
            optimistic = existing.map((item) =>
              item.emoji === emoji
                ? { ...item, count: item.count + 1, reactedByMe: true }
                : item
            );
          } else {
            optimistic = [...existing, { emoji, count: 1, reactedByMe: true }];
          }

          optimistic = [...optimistic].sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.emoji.localeCompare(b.emoji);
          });
          return { ...message, reactionSummary: optimistic };
        })
      );
      return optimistic;
    },
    []
  );

  const handleShareMessage = (messageId: string) => {
    setShareTarget({ messageId });
  };

  const handleReplyMessage = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) return;
    if (message.kind === "SYSTEM") return;
    const replySnippet =
      message.type === "IMAGE"
        ? "Photo"
        : message.type === "VIDEO"
        ? "Video"
        : message.type === "FILE"
        ? message.content || "File"
        : (message.content ?? "").slice(0, 80) || "Message";
    setReplyTo({
      id: message.id,
      senderName: message.sender?.name ?? message.sender?.username ?? "Member",
      type: message.type,
      content: replySnippet,
      mediaUrl: message.mediaUrl ?? undefined,
    });
  };

  const handleAskAi = useCallback(
    (messageId: string) => {
      if (!group?.chatId) return;
      void openAiPanel({ chatId: group.chatId, targetMessageId: messageId });
    },
    [group?.chatId, openAiPanel]
  );

  const handleCopyMessage = (messageId: string, content: string) => {
    const message = messages.find((item) => item.id === messageId);
    const text = content || message?.content || message?.mediaUrl || "";
    if (!text) return;
    void navigator.clipboard?.writeText(text);
  };

  const handleForwardMessage = (messageId: string) => {
    const target = messages.find((item) => item.id === messageId);
    if (!target || target.deletedForEveryone) return;
    if (!isMultiSelect) {
      setIsMultiSelect(true);
      setSelectedMessageIds({ [messageId]: true });
    } else {
      toggleMessageSelected(messageId);
    }
    setSelectionIntent("forward");
    setDeleteDialogOpen(false);
  };

  const handleStarMessage = (messageId: string) => {
    setStarredMessageIds((prev) => {
      const next = { ...prev };
      if (next[messageId]) {
        delete next[messageId];
      } else {
        next[messageId] = true;
      }
      return next;
    });
  };

  const handleReactMessage = useCallback(
    async (messageId: string, emoji: string) => {
      const previous =
        messages.find((message) => message.id === messageId)?.reactionSummary ?? [];
      applyOptimisticReactionToggle(messageId, emoji);
      try {
        const result = await toggleMessageReaction(messageId, emoji);
        applyReactionSummary(messageId, result.summary);
      } catch (error) {
        applyReactionSummary(messageId, previous);
        console.error("Failed to toggle group reaction", error);
      }
    },
    [applyOptimisticReactionToggle, applyReactionSummary, messages]
  );

  const handleDeleteMessage = async (messageId: string) => {
    if (!messageId) return;
    setIsMultiSelect(true);
    setSelectedMessageIds({ [messageId]: true });
    setSelectionIntent("delete");
    setDeleteDialogOpen(false);
  };

  const handleSaveMessageToMemory = useCallback(
    (messageId: string) => {
      if (!group?.chatId) return;
      void knowledgeActions.saveToMemory({
        chatId: group.chatId,
        groupId,
        messageIds: [messageId],
        knowledgeType: "SUMMARY",
      });
    },
    [group?.chatId, groupId, knowledgeActions]
  );

  const handleSaveMessageToKnowledge = useCallback(
    (messageId: string) => {
      if (!group?.chatId) return;
      void knowledgeActions.saveToKnowledge({
        chatId: group.chatId,
        groupId,
        messageIds: [messageId],
        knowledgeType: "SUMMARY",
      });
    },
    [group?.chatId, groupId, knowledgeActions]
  );

  const toggleMessageSelected = (messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = { ...prev };
      if (next[messageId]) {
        delete next[messageId];
      } else {
        next[messageId] = true;
      }
      if (Object.keys(next).length === 0) {
        setIsMultiSelect(false);
      }
      return next;
    });
  };

  const cancelSelectionMode = () => {
    setIsMultiSelect(false);
    setSelectedMessageIds({});
    setDeleteDialogOpen(false);
    setSelectionIntent(null);
    setForwardPickerOpen(false);
    setPendingForwardMessageIds([]);
    setSelectedForwardChatIds({});
    setIsForwarding(false);
  };

  const selectedMessages = useMemo(
    () => messages.filter((message) => Boolean(selectedMessageIds[message.id])),
    [messages, selectedMessageIds]
  );

  const canDeleteForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.every((message) => {
      if (message.deletedForEveryone) return false;
      return message.senderId === authUser?.id;
    });

  const handlePrepareForwardSelection = () => {
    const selectedIds = messages
      .filter((message) => Boolean(selectedMessageIds[message.id]) && !message.deletedForEveryone)
      .map((message) => message.id);

    if (selectedIds.length === 0) return;

    setPendingForwardMessageIds(selectedIds);
    setSelectedForwardChatIds({});
    setForwardPickerOpen(true);
    setIsMultiSelect(false);
    setSelectedMessageIds({});
    setDeleteDialogOpen(false);
    setSelectionIntent(null);
  };

  const handleConfirmForwardTargets = async () => {
    const targetChatIds = Object.keys(selectedForwardChatIds);
    if (pendingForwardMessageIds.length === 0 || targetChatIds.length === 0 || isForwarding) return;

    setIsForwarding(true);
    await forwardMessagesApi({
      messageIds: pendingForwardMessageIds,
      targetChatIds,
    });
    const latestChats = await fetchChats();
    setChats(latestChats);
    setForwardPickerOpen(false);
    setPendingForwardMessageIds([]);
    setSelectedForwardChatIds({});
    setIsForwarding(false);
  };

  const handleConfirmDelete = async (scope: "ME" | "EVERYONE") => {
    const messageIds = Object.keys(selectedMessageIds);
    if (messageIds.length === 0) return;
    try {
      const result = await deleteMessages({ messageIds, scope });
      if (scope === "ME") {
        const deletedIds = result.deletedMessageIds ?? result.successIds ?? [];
        if (deletedIds.length > 0) {
          rememberHiddenMessages(deletedIds);
          const idSet = new Set(deletedIds);
          setMessages((prev) => prev.filter((item) => !idSet.has(item.id)));
        }
      } else {
        const deleted = result.deletedMessages ?? [];
        if (deleted.length > 0) {
          const idSet = new Set(deleted.map((item) => item.id));
          setMessages((prev) =>
            prev.map((item) =>
              idSet.has(item.id)
                ? {
                    ...item,
                    content: null,
                    mediaUrl: null,
                    type: "TEXT" as const,
                    deletedForEveryone: true,
                    deletedAt: deleted[0]?.deletedAt ?? new Date().toISOString(),
                    deletedById: deleted[0]?.deletedById ?? authUser?.id ?? null,
                  }
                : item
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to delete selected group messages", error);
    } finally {
      cancelSelectionMode();
    }
  };

  const handleSelectionTrigger = (messageId: string) => {
    if (!messageId) return false;
    if (!isMultiSelect) {
      setIsMultiSelect(true);
      setSelectedMessageIds({ [messageId]: true });
      setSelectionIntent("delete");
      return true;
    }
    toggleMessageSelected(messageId);
    return true;
  };

  const forwardTargetsDirect = chats
    .filter((chat) => chat.type === "DIRECT")
    .map((chat) => toChatListItem(chat, authUser?.id));

  const addMemberCandidates = useMemo(() => {
    const existingMemberIds = new Set(group?.members.map((member) => member.userId) ?? []);
    return chats
      .filter((chat) => chat.type === "DIRECT")
      .map((chat) => toChatListItem(chat, authUser?.id))
      .filter((item) => item.peerUserId && !existingMemberIds.has(item.peerUserId))
      .map((item) => ({
        userId: item.peerUserId as string,
        name: item.title,
        username: item.username,
        avatar: item.avatar ?? null,
      }));
  }, [authUser?.id, chats, group?.members]);

  const creatorLeaveCandidates = useMemo(
    () =>
      (group?.members ?? [])
        .filter((member) => member.userId !== authUser?.id)
        .map((member) => ({
          userId: member.userId,
          label: member.user.name ?? member.user.username,
          username: member.user.username,
          role: member.role,
        })),
    [authUser?.id, group?.members]
  );

  const requestLeaveGroup = useCallback(() => {
    if (!group) return;
    if (group.myRole !== "CREATOR") {
      setIsLeavingGroup(true);
      setLeaveActionError(null);
      void leaveGroup(groupId)
        .then(() => navigate("/groups"))
        .catch((error) => {
          setLeaveActionError(getApiErrorMessage(error));
        })
        .finally(() => setIsLeavingGroup(false));
      return;
    }

    setLeaveActionError(null);
    setSelectedNewAdminId("");
    setLeaveModalOpen(true);
  }, [group, groupId, navigate]);

  const confirmCreatorLeave = useCallback(() => {
    if (!selectedNewAdminId) {
      setLeaveActionError("Select a new admin before leaving.");
      return;
    }
    setIsLeavingGroup(true);
    setLeaveActionError(null);
    void leaveGroup(groupId, selectedNewAdminId)
      .then(() => {
        setLeaveModalOpen(false);
        navigate("/groups");
      })
      .catch((error) => {
        const code = getApiErrorCode(error);
        if (code === "CREATOR_MUST_ASSIGN_ADMIN") {
          setLeaveActionError("Choose a new admin before leaving.");
          return;
        }
        setLeaveActionError(getApiErrorMessage(error));
      })
      .finally(() => setIsLeavingGroup(false));
  }, [groupId, navigate, selectedNewAdminId]);

  useEffect(() => {
    const routeState = location.state as { openLeaveModal?: boolean } | null;
    if (!routeState?.openLeaveModal) return;
    if (!group) return;
    if (consumedRouteLeaveRef.current) return;
    consumedRouteLeaveRef.current = true;
    requestLeaveGroup();
  }, [group, location.state, requestLeaveGroup]);

  const forwardTargetsGroup = chats
    .filter((chat) => chat.type === "GROUP" && chat.id !== group?.chatId)
    .map((chat) => toChatListItem(chat, authUser?.id));

  const forwardTargets = [...forwardTargetsDirect, ...forwardTargetsGroup];

  const buildMessagePayload = useCallback(
    (messageId: string) => {
      const source = messages.find((item) => item.id === messageId);
      if (!source) return null;
      return {
        content: source.content ?? undefined,
        mediaUrl: source.mediaUrl ?? undefined,
        type: source.type,
      };
    },
    [messages]
  );

  const handleShareToChat = useCallback(
    async (targetChatId: string) => {
      if (!shareTarget) return;
      const payload = buildMessagePayload(shareTarget.messageId);
      if (!payload) return;

      await sendMessage({
        chatId: targetChatId,
        content: payload.content,
        mediaUrl: payload.mediaUrl,
        type: payload.type,
      });

      const latestChats = await fetchChats();
      setChats(latestChats);
      setShareTarget(null);
    },
    [buildMessagePayload, setChats, shareTarget]
  );

  const handleShareToGroupPage = useCallback(() => {
    if (!shareTarget) return;
    const payload = buildMessagePayload(shareTarget.messageId);
    if (!payload) return;

    navigate("/groups", {
      state: {
        activeSection: "groups",
        sharePayload: payload,
      },
    });
    setShareTarget(null);
  }, [buildMessagePayload, navigate, shareTarget]);

  const handleShareToAi = useCallback(() => {
    if (!shareTarget) return;
    const payload = buildMessagePayload(shareTarget.messageId);
    if (!payload) return;

    const shareText = [payload.content ?? "", payload.mediaUrl ?? ""].filter(Boolean).join("\n").trim();
    navigate(`/ai/${uuid()}`, {
      state: {
        initialMessage: shareText || "Shared from group chat",
      },
    });
    setShareTarget(null);
  }, [buildMessagePayload, navigate, shareTarget]);

  const handleOutsideShare = useCallback(async () => {
    if (!shareTarget) return;
    const payload = buildMessagePayload(shareTarget.messageId);
    if (!payload) return;

    const shareText = [payload.content ?? "", payload.mediaUrl ?? ""].filter(Boolean).join("\n").trim();
    await shareMessage({
      title: group?.title ?? "Group",
      text: shareText || "Shared from group chat",
      url: /^https?:\/\//i.test(payload.mediaUrl ?? "") ? payload.mediaUrl : undefined,
    });
  }, [buildMessagePayload, group?.title, shareTarget]);

  return (
    <div className="flex h-full w-full flex-col overflow-visible bg-gradient-to-b from-[#020617] via-zinc-950 to-[#020617] text-white">
      <GroupChatHeader
        group={group}
        roleLabel={roleLabel}
        canInteract={isMember}
        onOpenInfoPanel={() => setShowInfoPanel(true)}
        onLeaveGroup={requestLeaveGroup}
      />

      {knowledgeActions.notice ? (
        <div className="mx-3 mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          {knowledgeActions.notice}
        </div>
      ) : null}
      {knowledgeActions.error ? (
        <div className="mx-3 mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {knowledgeActions.error}
        </div>
      ) : null}

      {!isMember && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          You left this group. You can't send messages.
        </div>
      )}
      {loadError && (
        <div className="mx-3 mt-3 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {loadError}
        </div>
      )}
      {leaveActionError && (
        <div className="mx-3 mt-3 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {leaveActionError}
        </div>
      )}

      {isMultiSelect && (
        <div className="px-3 py-2">
          <div className="flex items-center justify-between rounded-xl border border-cyan-400/25 bg-zinc-900/65 px-3 py-2 backdrop-blur">
            <div className="text-sm">{Object.keys(selectedMessageIds).length} selected</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelSelectionMode}
                className="rounded-lg px-3 py-1 text-xs text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={
                  selectionIntent === "forward"
                    ? handlePrepareForwardSelection
                    : () => setDeleteDialogOpen(true)
                }
                disabled={Object.keys(selectedMessageIds).length === 0}
                className={`rounded-lg px-3 py-1 text-xs text-white disabled:opacity-50 ${
                  selectionIntent === "forward" ? "bg-sky-600" : "bg-rose-600"
                }`}
              >
                {selectionIntent === "forward" ? "Next" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={messageViewportRef}
        onLoadCapture={() => {
          if (isAtBottom) {
            scrollToBottom({ behavior: "auto" });
          }
        }}
        className="relative flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-zinc-700"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_8%,rgba(34,211,238,0.1),transparent_42%),radial-gradient(circle_at_15%_88%,rgba(16,185,129,0.08),transparent_40%)]" />
        <div className="space-y-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {renderedMessageItems.map((item) => {
            if (item.kind === "separator") {
              return (
                <motion.div
                  key={item.key}
                  layout
                  transition={layoutTransition}
                  style={optimizedMotionStyle}
                >
                  <DateSeparator text={item.label} />
                </motion.div>
              );
            }

            const msg = item.message;
            const showAvatar = !item.previousSenderId || item.previousSenderId !== msg.senderId;
            const entryVariant = msg.isMine ? messageSendVariant : messageReceiveVariant;
            if (isMultiSelect) {
              const checked = Boolean(selectedMessageIds[msg.id]);
              return (
                <motion.div
                  key={msg.id}
                  ref={(el) => {
                    messageRefs.current[msg.id] = el;
                  }}
                  layout
                  transition={layoutTransition}
                  variants={entryVariant}
                  initial={shouldReduceMotion ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  style={optimizedMotionStyle}
                  className={`flex items-center gap-2 rounded-xl transition ${
                    msg.isMine ? "justify-end" : "justify-start"
                  } ${
                    highlightedMessageId === msg.id ? "ring-2 ring-sky-400/80 bg-sky-500/10" : ""
                  }`}
                >
                  {!msg.isMine && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMessageSelected(msg.id)}
                      className="h-4 w-4 accent-sky-500"
                    />
                  )}
                  <div
                    onClick={() => toggleMessageSelected(msg.id)}
                    className="flex-1 cursor-pointer text-left"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleMessageSelected(msg.id);
                      }
                    }}
                  >
                    <GroupMessageBubble
                      message={msg}
                      disableActions
                      showAvatar={!msg.isMine && showAvatar}
                      showName={!msg.isMine && showAvatar}
                      isLastInGroup
                      canDelete={msg.isMine}
                      autoDownloadMedia={autoDownloadMedia}
                      onOpenSeenBy={(messageId) => {
                        setSeenByMessageId(messageId);
                        setSeenByLoading(true);
                        void fetchMessageReads(messageId)
                          .then((items) => {
                            setSeenByItems(items);
                          })
                          .finally(() => {
                            setSeenByLoading(false);
                          });
                      }}
                    />
                  </div>
                  {msg.isMine && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMessageSelected(msg.id)}
                      className="h-4 w-4 accent-sky-500"
                    />
                  )}
                </motion.div>
              );
            }
            return (
              <motion.div
                key={msg.id}
                ref={(el) => {
                  messageRefs.current[msg.id] = el;
                }}
                layout
                transition={layoutTransition}
                variants={entryVariant}
                initial={shouldReduceMotion ? false : "initial"}
                animate="animate"
                exit="exit"
                style={optimizedMotionStyle}
                className={`rounded-xl transition ${
                  highlightedMessageId === msg.id ? "ring-2 ring-sky-400/80 bg-sky-500/10" : ""
                }`}
              >
                <GroupMessageBubble
                  message={msg}
                  disableActions={!isMember}
                  showAvatar={!msg.isMine && showAvatar}
                  showName={!msg.isMine && showAvatar}
                  isLastInGroup
                  canDelete={msg.isMine}
                  menuOpen={openMenuMessageId === msg.id}
                  onRequestMenuOpen={setOpenMenuMessageId}
                  onRequestMenuClose={() => setOpenMenuMessageId(null)}
                  autoDownloadMedia={autoDownloadMedia}
                  onOpenMedia={(payload) => {
                    setViewer(payload);
                    setOpenMenuMessageId(null);
                  }}
                  onShare={handleShareMessage}
                  onReply={handleReplyMessage}
                  onAskAi={handleAskAi}
                  onCopy={handleCopyMessage}
                  onForward={handleForwardMessage}
                  onStar={handleStarMessage}
                  onReact={handleReactMessage}
                  onDelete={handleDeleteMessage}
                  onSaveToMemory={handleSaveMessageToMemory}
                  onSaveToKnowledge={handleSaveMessageToKnowledge}
                  onSelectionTrigger={handleSelectionTrigger}
                  onReplyPreviewClick={(messageId) => {
                    void jumpToMessage(messageId);
                  }}
                  onOpenSeenBy={(messageId) => {
                    setSeenByMessageId(messageId);
                    setSeenByLoading(true);
                    void fetchMessageReads(messageId)
                      .then((items) => {
                        setSeenByItems(items);
                      })
                      .finally(() => {
                        setSeenByLoading(false);
                      });
                  }}
                />
              </motion.div>
            );
            })}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {!isMultiSelect && unseenCount > 0 && !isAtBottom && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => scrollToBottom({ behavior: "smooth" })}
              className="absolute bottom-4 right-4 z-20 rounded-full border border-cyan-300/35 bg-zinc-900/90 px-3 py-2 text-xs font-medium text-cyan-100 shadow-lg backdrop-blur"
            >
              New messages ({unseenCount})
            </motion.button>
          )}
        </AnimatePresence>
        {group?.chatId ? (
          <AiPanel
            chatId={group.chatId}
            messages={messages.map((item) => ({
              id: item.id,
              content: item.content ?? null,
              mediaUrl: item.mediaUrl ?? null,
              type: item.type,
              deletedForEveryone: item.deletedForEveryone,
            }))}
          />
        ) : null}
      </div>

      <AnimatePresence>
        {viewer && (
          <MediaViewerModal
            type={viewer.type}
            url={viewer.url}
            caption={viewer.caption}
            layoutId={`media-${viewer.messageId}`}
            onClose={() => setViewer(null)}
            onDelete={() => {
              void handleDeleteMessage(viewer.messageId);
              setViewer(null);
            }}
            onForward={() => {
              handleForwardMessage(viewer.messageId);
            }}
            onDownload={() => {
              const source = messages.find((item) => item.id === viewer.messageId);
              const mediaUrl = source?.mediaUrl ?? viewer.url;
              if (!mediaUrl) return;
              const link = document.createElement("a");
              link.href = mediaUrl;
              link.download = `group-media-${viewer.messageId}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          />
        )}
      </AnimatePresence>

      <div className="border-t border-cyan-400/20 bg-zinc-950/85 backdrop-blur-xl">
        {isMember ? (
          <ChatComposer
            enterToSend={enterToSend}
            replyTo={replyTo ?? undefined}
            onCancelReply={() => setReplyTo(null)}
            onSend={(payload) => {
              void (async (composerPayload: ChatComposerPayload) => {
                if (!isMember) {
                  setLeaveActionError("You left this group. You can't send messages.");
                  return;
                }
                const {
                  text,
                  files,
                  replyToId,
                  gifUrl,
                  voiceBlob,
                  voiceDurationSeconds,
                  videoBlob,
                  videoDurationSeconds,
                } = composerPayload;
              const caption = text?.trim();
              const createOptimisticMediaMessage = (payload: {
                content: string;
                mediaUrl: string;
                type: "IMAGE" | "VIDEO" | "FILE";
                targetReplyToId?: string;
              }) => {
                const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const optimisticMessage: GroupClientMessage = {
                  id: tempId,
                  localId: tempId,
                  localStatus: "SENDING",
                  chatId: group?.chatId ?? "",
                  senderId: authUser?.id ?? null,
                  sender: authUser
                    ? {
                        id: authUser.id,
                        username: authUser.username,
                        name: authUser.name,
                        avatar: authUser.avatar,
                      }
                    : null,
                  kind: "USER",
                  systemEvent: null,
                  systemActor: null,
                  content: payload.content,
                  mediaUrl: payload.mediaUrl,
                  type: payload.type,
                  deletedForEveryone: false,
                  deletedAt: null,
                  deletedById: null,
                  replyToId: payload.targetReplyToId ?? null,
                  replyTo: null,
                  isForwarded: false,
                  forwardFromMessageId: null,
                  forwardFromSenderId: null,
                  createdAt: new Date().toISOString(),
                  status: "SENT",
                  readCount: 0,
                  deliveredToAtLeastOne: false,
                  reactionSummary: [],
                };
                setMessages((prev) => [...prev, optimisticMessage]);
                return tempId;
              };

              const sendTextOnly = async (plainText: string, targetReplyToId?: string) => {
                const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const optimisticMessage: GroupClientMessage = {
                  id: tempId,
                  localId: tempId,
                  localStatus: "SENDING",
                  chatId: group?.chatId ?? "",
                  senderId: authUser?.id ?? null,
                  sender: authUser
                    ? {
                        id: authUser.id,
                        username: authUser.username,
                        name: authUser.name,
                        avatar: authUser.avatar,
                      }
                    : null,
                  kind: "USER",
                  systemEvent: null,
                  systemActor: null,
                  content: plainText,
                  mediaUrl: null,
                  type: "TEXT",
                  deletedForEveryone: false,
                  deletedAt: null,
                  deletedById: null,
                  replyToId: targetReplyToId ?? null,
                  replyTo: null,
                  isForwarded: false,
                  forwardFromMessageId: null,
                  forwardFromSenderId: null,
                  createdAt: new Date().toISOString(),
                  status: "SENT",
                  readCount: 0,
                  deliveredToAtLeastOne: false,
                  reactionSummary: [],
                };

                setMessages((prev) => [...prev, optimisticMessage]);
                try {
                  const sent = await postGroupMessage(groupId, {
                    text: plainText,
                    replyToId: targetReplyToId,
                  });
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.localId === tempId ? normalizeGroupMessage(sent) : message
                    )
                  );
                  setReplyTo(null);
                } catch (error) {
                  setMessages((prev) => prev.filter((message) => message.localId !== tempId));
                  if (getApiErrorCode(error) === "NOT_A_MEMBER") {
                    setLeaveActionError("You left this group. You can't send messages.");
                    return;
                  }
                  console.error("Failed to send group text message", error);
                }
              };

              try {
                if (gifUrl) {
                  const gifText = caption || "GIF";
                  const tempId = createOptimisticMediaMessage({
                    content: gifText,
                    mediaUrl: gifUrl,
                    type: "IMAGE",
                    targetReplyToId: replyToId ?? undefined,
                  });
                  try {
                    const sent = await postGroupMessage(groupId, {
                      text: gifText,
                      replyToId,
                      mediaUrl: gifUrl,
                      mediaType: "IMAGE",
                    });
                    setMessages((prev) =>
                      prev.map((message) =>
                        message.localId === tempId ? normalizeGroupMessage(sent) : message
                      )
                    );
                    setReplyTo(null);
                  } catch (error) {
                    setMessages((prev) => prev.filter((message) => message.localId !== tempId));
                    throw error;
                  }
                  return;
                }

                if (voiceBlob) {
                  const file = new File([voiceBlob], `voice-${Date.now()}.webm`, {
                    type: voiceBlob.type || "audio/webm",
                  });
                  const mediaUrl = await fileToDataUrl(file);
                  const voiceText =
                    caption || `Voice message${voiceDurationSeconds ? ` (${voiceDurationSeconds}s)` : ""}`;
                  const tempId = createOptimisticMediaMessage({
                    content: voiceText,
                    mediaUrl,
                    type: "FILE",
                    targetReplyToId: replyToId ?? undefined,
                  });
                  try {
                    const sent = await postGroupMessage(groupId, {
                      text: voiceText,
                      replyToId,
                      mediaUrl,
                      mediaType: "FILE",
                    });
                    setMessages((prev) =>
                      prev.map((message) =>
                        message.localId === tempId ? normalizeGroupMessage(sent) : message
                      )
                    );
                    setReplyTo(null);
                  } catch (error) {
                    setMessages((prev) => prev.filter((message) => message.localId !== tempId));
                    throw error;
                  }
                  return;
                }

                if (videoBlob) {
                  const file = new File([videoBlob], `video-${Date.now()}.webm`, {
                    type: videoBlob.type || "video/webm",
                  });
                  const mediaUrl = await fileToDataUrl(file);
                  const videoText =
                    caption || `Video clip${videoDurationSeconds ? ` (${videoDurationSeconds}s)` : ""}`;
                  const tempId = createOptimisticMediaMessage({
                    content: videoText,
                    mediaUrl,
                    type: "VIDEO",
                    targetReplyToId: replyToId ?? undefined,
                  });
                  try {
                    const sent = await postGroupMessage(groupId, {
                      text: videoText,
                      replyToId,
                      mediaUrl,
                      mediaType: "VIDEO",
                    });
                    setMessages((prev) =>
                      prev.map((message) =>
                        message.localId === tempId ? normalizeGroupMessage(sent) : message
                      )
                    );
                    setReplyTo(null);
                  } catch (error) {
                    setMessages((prev) => prev.filter((message) => message.localId !== tempId));
                    throw error;
                  }
                  return;
                }

                if (files?.length) {
                  for (const [index, file] of files.entries()) {
                    const mediaType = toGroupMessageType(file);
                    const mediaUrl = await fileToDataUrl(file);
                    const messageText =
                      index === 0
                        ? caption || (mediaType === "FILE" ? file.name : mediaType)
                        : mediaType === "FILE"
                        ? file.name
                        : mediaType;
                    const targetReplyToId = index === 0 ? replyToId ?? undefined : undefined;
                    const tempId = createOptimisticMediaMessage({
                      content: messageText,
                      mediaUrl,
                      type: mediaType,
                      targetReplyToId,
                    });
                    try {
                      const sent = await postGroupMessage(groupId, {
                        text: messageText,
                        replyToId: targetReplyToId,
                        mediaUrl,
                        mediaType,
                      });
                      setMessages((prev) =>
                        prev.map((message) =>
                          message.localId === tempId ? normalizeGroupMessage(sent) : message
                        )
                      );
                    } catch (error) {
                      setMessages((prev) => prev.filter((message) => message.localId !== tempId));
                      throw error;
                    }
                  }
                  setReplyTo(null);
                  return;
                }

                if (caption) {
                  await sendTextOnly(caption, replyToId);
                }
              } catch (error) {
                const code = getApiErrorCode(error);
                if (code === "NOT_A_MEMBER") {
                  setLeaveActionError("You left this group. You can't send messages.");
                  return;
                }
                console.error("Failed to send group message", error);
              }
              })(payload);
            }}
            isSending={isLeavingGroup}
          />
        ) : (
          <div className="px-4 py-3 text-xs text-zinc-400">
            Messaging is disabled because you are no longer a member of this group.
          </div>
        )}
      </div>

      {leaveModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100">
            <div className="text-sm font-semibold">Assign new admin before leaving</div>
            <div className="mt-1 text-xs text-zinc-400">
              Choose an active member who will become the creator.
            </div>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {creatorLeaveCandidates.map((candidate) => (
                <button
                  key={candidate.userId}
                  type="button"
                  onClick={() => setSelectedNewAdminId(candidate.userId)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${
                    selectedNewAdminId === candidate.userId
                      ? "border-sky-500 bg-sky-500/10 text-sky-100"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-200"
                  }`}
                >
                  <div>
                    <div>{candidate.label}</div>
                    <div className="text-zinc-500">@{candidate.username}</div>
                  </div>
                  <div className="text-[10px] uppercase text-zinc-400">{candidate.role}</div>
                </button>
              ))}
            </div>

            {leaveActionError && (
              <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                {leaveActionError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveModalOpen(false)}
                className="rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLeavingGroup || !selectedNewAdminId}
                onClick={confirmCreatorLeave}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs text-white disabled:opacity-60"
              >
                {isLeavingGroup ? "Leaving..." : "Assign and leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      <GroupInfoPanel
        open={showInfoPanel}
        group={group}
        intelligence={groupIntelligence}
        addMemberCandidates={addMemberCandidates}
        onClose={() => setShowInfoPanel(false)}
        onSaveDescription={(value) => {
          void patchGroup(groupId, { description: value }).then(() => {
            void refreshGroup();
          });
        }}
        onSaveRules={(value) => {
          void patchGroupRules(groupId, value).then(() => {
            void refreshGroup();
          });
        }}
        onRemoveMember={(userId) => {
          void removeGroupMember(groupId, userId).then(() => {
            void refreshGroup();
          });
        }}
        onAddMembers={(userIds) => {
          void addGroupMembers(groupId, userIds)
            .then(async () => {
              await refreshGroup();
              const latestChats = await fetchChats();
              setChats(latestChats);
            })
            .catch((error) => {
              console.error("Failed to add group members", error);
            });
        }}
        onPromote={(userId) => {
          void setGroupAdminRole(groupId, { userId, action: "PROMOTE" }).then(() => {
            void refreshGroup();
          });
        }}
        onDemote={(userId) => {
          void setGroupAdminRole(groupId, { userId, action: "DEMOTE" }).then(() => {
            void refreshGroup();
          });
        }}
        onCreateInvite={() => {
          void createGroupInvite(groupId).then(() => {
            void refreshGroup();
          });
        }}
        onRevokeInvite={() => {
          void revokeGroupInvite(groupId).then(() => {
            void refreshGroup();
          });
        }}
        onSaveAvatar={(avatar) => {
          void patchGroup(groupId, { avatar })
            .then(async () => {
              await refreshGroup();
              const latestChats = await fetchChats();
              setChats(latestChats);
            })
            .catch((error) => {
              console.error("Failed to update group avatar", error);
            });
        }}
        onRemoveAvatar={() => {
          void patchGroup(groupId, { avatar: null })
            .then(async () => {
              await refreshGroup();
              const latestChats = await fetchChats();
              setChats(latestChats);
            })
            .catch((error) => {
              console.error("Failed to remove group avatar", error);
            });
        }}
        onLeaveGroup={() => {
          requestLeaveGroup();
        }}
        onDeleteGroup={() => {
          void deleteGroup(groupId).then(() => navigate("/groups"));
        }}
      />

      <GroupChatOverlays
        seenByMessageId={seenByMessageId}
        seenByLoading={seenByLoading}
        seenByItems={seenByItems}
        onCloseSeenBy={() => setSeenByMessageId(null)}
        forwardPickerOpen={forwardPickerOpen}
        pendingForwardMessageIds={pendingForwardMessageIds}
        forwardTargets={forwardTargets}
        selectedForwardChatIds={selectedForwardChatIds}
        setSelectedForwardChatIds={setSelectedForwardChatIds}
        isForwarding={isForwarding}
        onCloseForwardPicker={() => {
          setForwardPickerOpen(false);
          setPendingForwardMessageIds([]);
          setSelectedForwardChatIds({});
        }}
        onConfirmForwardTargets={() => {
          void handleConfirmForwardTargets();
        }}
        shareTargetOpen={Boolean(shareTarget)}
        forwardTargetsDirect={forwardTargetsDirect}
        onCloseShare={() => setShareTarget(null)}
        onShareToChat={(chatId) => {
          void handleShareToChat(chatId);
        }}
        onShareToGroupPage={handleShareToGroupPage}
        onShareToAi={handleShareToAi}
        onOutsideShare={() => {
          void handleOutsideShare();
        }}
        deleteDialogOpen={deleteDialogOpen}
        isMultiSelect={isMultiSelect}
        selectedCount={Object.keys(selectedMessageIds).length}
        canDeleteForEveryone={canDeleteForEveryone}
        onDeleteForMe={() => {
          void handleConfirmDelete("ME");
        }}
        onDeleteForEveryone={() => {
          void handleConfirmDelete("EVERYONE");
        }}
        onCancelSelection={cancelSelectionMode}
      />
    </div>
  );
}

