import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuid } from "uuid";
import ChatHeader from "../components/chatComponents/ChatHeader";
import ChatMessages from "../components/chatComponents/ChatMessages";
import ChatComposer from "../components/chatComponents/ChatComposer";
import AiPanel from "../components/chatComponents/AiPanel";
import type { ChatComposerPayload } from "../components/chatComponents/ChatComposer";
import { useAutoSendMessage } from "../utils/autoSendMessage";
import {
  deleteMessages,
  fetchMessages,
  forwardMessages as forwardMessagesApi,
  sendMessage,
  toggleMessageReaction,
} from "../api/message.api";
import { fetchChats, markChatAsRead } from "../api/chat.api";
import { useAuthStore } from "../stores/authStore";
import { toChatListItem, toUiMessage, useChatStore, type UiMessage } from "../stores/chatStore";
import { useComposerStore } from "../stores/composerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useAiThreadStore } from "../stores/aiThreadStore";
import { useKnowledgeActions } from "../hooks/useKnowledgeActions";
import { getSocket } from "../lib/socket";
import { shareMessage } from "../utils/shareMessage";
import type { MessageRecord } from "../api/types";

type Props = {
  initialMessage?: string;
};

type SharePayload = {
  content?: string;
  mediaUrl?: string;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
};

const buildReplySnippet = (message: MessageRecord) => {
  if (message.type === "IMAGE") return "Photo";
  if (message.type === "VIDEO") return "Video";
  if (message.type === "FILE") return message.content || "File";
  return message.content || "Message";
};

type MediaPreset = {
  maxDimension: number;
  imageQuality: number;
  videoBitrateKbps: number;
};

const getMediaPreset = (mediaQuality: number): MediaPreset => {
  if (mediaQuality < 40) {
    return { maxDimension: 1280, imageQuality: 0.55, videoBitrateKbps: 900 };
  }
  if (mediaQuality < 80) {
    return { maxDimension: 1920, imageQuality: 0.75, videoBitrateKbps: 1600 };
  }
  return { maxDimension: 2560, imageQuality: 0.9, videoBitrateKbps: 2800 };
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });

const compressImage = async (file: File, preset: MediaPreset) => {
  if (!file.type.startsWith("image/")) return file;
  if (/image\/gif/i.test(file.type)) return file;

  const image = await loadImage(file);
  const scale = Math.min(1, preset.maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", preset.imageQuality);
  });
  if (!blob) return file;
  if (blob.size >= file.size) return file;

  const nextName = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], nextName, { type: "image/jpeg" });
};

export default function UserChatContainer({ initialMessage }: Props) {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((store) => store.user);
  const settings = useSettingsStore((store) => store.settings);
  const loadSettings = useSettingsStore((store) => store.loadSettings);

  const chats = useChatStore((store) => store.chats);
  const setChats = useChatStore((store) => store.setChats);
  const setMessages = useChatStore((store) => store.setMessages);
  const appendMessage = useChatStore((store) => store.appendMessage);
  const resetUnreadForChat = useChatStore((store) => store.resetUnreadForChat);
  const removeMessages = useChatStore((store) => store.removeMessages);
  const markMessagesDeletedForEveryone = useChatStore(
    (store) => store.markMessagesDeletedForEveryone
  );
  const updateMessageStatus = useChatStore((store) => store.updateMessageStatus);
  const messagesByChatId = useChatStore((store) => store.messagesByChatId);
  const typingUsersByChatId = useChatStore((store) => store.typingUsersByChatId);
  const onlineUsers = useChatStore((store) => store.onlineUsers);
  const clearTypingUsersForChat = useChatStore((store) => store.clearTypingUsersForChat);
  const isMultiSelect = useChatStore((store) => store.isMultiSelect);
  const selectedMessageIds = useChatStore((store) => store.selectedMessageIds);
  const selectionVersion = useChatStore((store) => store.selectionVersion);
  const resetMultiSelect = useChatStore((store) => store.resetMultiSelect);
  const openAiPanel = useAiThreadStore((store) => store.openPanel);
  const clearAiForChatSwitch = useAiThreadStore((store) => store.clearForChatSwitch);
  const knowledgeActions = useKnowledgeActions();

  const [selectionIntent, setSelectionIntent] = useState<"delete" | "forward" | null>(null);
  const [shareTarget, setShareTarget] = useState<{ messageId: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [pendingForwardMessageIds, setPendingForwardMessageIds] = useState<string[]>([]);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<Record<string, true>>({});
  const [isForwarding, setIsForwarding] = useState(false);
  const [uploadingMessages, setUploadingMessages] = useState<UiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [starredMessageIdsByChat, setStarredMessageIdsByChat] = useState<
    Record<string, Record<string, true>>
  >({});
  const enterToSend = settings?.chat.enterToSend ?? true;
  const autoDownloadMedia = settings?.chat.autoDownload ?? true;
  const mediaQuality = settings?.chat.mediaQuality ?? 70;

  const replyTo = useComposerStore((store) => store.replyTo);
  const setReplyTo = useComposerStore((store) => store.setReplyTo);
  const clearComposerState = useComposerStore((store) => store.clearComposerState);

  const fileToDataUrlWithProgress = (
    file: File,
    onProgress: (progress: number) => void
  ) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
      reader.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      };
      reader.readAsDataURL(file);
    });

  const toMessageType = (file: File): "IMAGE" | "VIDEO" | "FILE" => {
    if (file.type.startsWith("image/")) return "IMAGE";
    if (file.type.startsWith("video/")) return "VIDEO";
    return "FILE";
  };

  useEffect(() => {
    if (settings) return;
    void loadSettings();
  }, [loadSettings, settings]);

  const selectedChat = useMemo(() => {
    if (!chatId) return null;

    const byId = chats.find((chat) => chat.id === chatId);
    if (byId) return byId;

    const normalized = decodeURIComponent(chatId).replace(/^@/, "").toLowerCase();
    return (
      chats.find((chat) =>
        chat.participants.some((participant) => participant.user.username.toLowerCase() === normalized)
      ) ?? null
    );
  }, [chatId, chats]);

  const selectedChatId = selectedChat?.id ?? null;
  const currentMessages = selectedChatId ? messagesByChatId[selectedChatId] ?? [] : [];

  const applyReactionSummary = useCallback(
    (
      messageId: string,
      summary: Array<{ emoji: string; count: number; reactedByMe: boolean }>
    ) => {
      if (!selectedChatId) return;
      const normalized = summary.filter((item) => item.count > 0);
      setMessages(
        selectedChatId,
        currentMessages.map((message) =>
          message.id === messageId
            ? { ...message, reactionSummary: normalized }
            : message
        )
      );
    },
    [currentMessages, selectedChatId, setMessages]
  );

  const applyOptimisticReactionToggle = useCallback(
    (messageId: string, emoji: string) => {
      if (!selectedChatId) return [] as Array<{
        emoji: string;
        count: number;
        reactedByMe: boolean;
      }>;

      let nextSummary: Array<{ emoji: string; count: number; reactedByMe: boolean }> = [];
      setMessages(
        selectedChatId,
        currentMessages.map((message) => {
          if (message.id !== messageId) return message;
          const existing = message.reactionSummary ?? [];
          const found = existing.find((item) => item.emoji === emoji);
          if (found?.reactedByMe) {
            nextSummary = existing
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
            nextSummary = existing.map((item) =>
              item.emoji === emoji
                ? { ...item, count: item.count + 1, reactedByMe: true }
                : item
            );
          } else {
            nextSummary = [...existing, { emoji, count: 1, reactedByMe: true }];
          }

          nextSummary = [...nextSummary].sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.emoji.localeCompare(b.emoji);
          });
          return { ...message, reactionSummary: nextSummary };
        })
      );

      return nextSummary;
    },
    [currentMessages, selectedChatId, setMessages]
  );

  useEffect(() => {
    if (!selectedChatId) return;
    const run = async () => {
      try {
        const data = await fetchMessages(selectedChatId, 100);
        setMessages(selectedChatId, [...data.items].reverse());
      } catch (error) {
        console.error("Failed to fetch chat messages", error);
      }
    };
    void run();
  }, [selectedChatId, setMessages]);

  useEffect(() => {
    if (!selectedChatId) return;
    getSocket()?.emit("join_chat", { chatId: selectedChatId });
  }, [selectedChatId]);

  useEffect(() => {
    resetMultiSelect();
    setSelectionIntent(null);
    clearComposerState();
    setDeleteDialogOpen(false);
    setUploadingMessages([]);
    setForwardPickerOpen(false);
    setPendingForwardMessageIds([]);
    setSelectedForwardChatIds({});
    setIsForwarding(false);
    if (selectedChatId) {
      clearAiForChatSwitch(selectedChatId);
    }
  }, [clearAiForChatSwitch, clearComposerState, resetMultiSelect, selectedChatId]);

  useEffect(() => {
    if (isMultiSelect) return;
    setDeleteDialogOpen(false);
    setSelectionIntent(null);
  }, [isMultiSelect]);

  useEffect(() => {
    if (!selectedChatId) return;

    const markRead = () => {
      resetUnreadForChat(selectedChatId);
      void markChatAsRead(selectedChatId).catch((error) => {
        console.error("Failed to mark chat read", error);
      });
    };

    markRead();

    const onFocus = () => {
      markRead();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markRead();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [resetUnreadForChat, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || !authUser?.id) return;
    const hasIncomingUnread = currentMessages.some(
      (message) => message.senderId !== authUser.id && message.status !== "READ"
    );
    if (!hasIncomingUnread) return;

    const socket = getSocket();
    // Send DELIVERED first; otherwise mark_read can move messages to READ
    // server-side before delivered update runs, skipping realtime status updates.
    currentMessages
      .filter((message) => message.senderId !== authUser.id && message.status === "SENT")
      .forEach((message) => {
        socket?.emit("message_delivered", {
          chatId: selectedChatId,
          messageId: message.id,
        });
        updateMessageStatus(selectedChatId, message.id, "DELIVERED");
      });

    socket?.emit("mark_read", { chatId: selectedChatId });

  }, [
    authUser?.id,
    currentMessages,
    selectedChatId,
    updateMessageStatus,
  ]);

  useEffect(() => {
    if (!selectedChatId) return;
    return () => {
      clearTypingUsersForChat(selectedChatId);
    };
  }, [clearTypingUsersForChat, selectedChatId]);

  const sendTextMessage = useCallback(
    async (text: string, replyToId?: string) => {
      if (!selectedChatId) return;
      const created = await sendMessage({
        chatId: selectedChatId,
        content: text,
        type: "TEXT",
        replyToId,
      });
      appendMessage(created);
      setReplyTo(null);
    },
    [appendMessage, selectedChatId, setReplyTo]
  );

  const handleSend = useCallback(
    async ({
      text,
      files,
      replyToId,
      gifUrl,
      voiceBlob,
      voiceDurationSeconds,
      videoBlob,
      videoDurationSeconds,
    }: ChatComposerPayload) => {
      if (!selectedChatId) return;
      const caption = text?.trim();
      setIsSending(true);

      try {
        if (gifUrl) {
          const created = await sendMessage({
            chatId: selectedChatId,
            type: "IMAGE",
            mediaUrl: gifUrl,
            replyToId,
          });
          appendMessage(created);
          setReplyTo(null);
          return;
        }

        if (voiceBlob) {
          const tempId = `voice-${Date.now()}`;
          const objectUrl = URL.createObjectURL(voiceBlob);
          const voiceLabel = `Voice message${voiceDurationSeconds ? ` (${voiceDurationSeconds}s)` : ""}`;

          setUploadingMessages((prev) => [
            ...prev,
            {
              id: tempId,
              sender: "me",
              senderId: authUser?.id ?? "me",
              content: voiceLabel,
              text: voiceLabel,
              mediaUrl: objectUrl,
              messageType: "FILE",
              createdAt: new Date().toISOString(),
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              status: "sent",
              isUploading: true,
              uploadProgress: 10,
            },
          ]);

          const mediaUrl = await fileToDataUrlWithProgress(
            new File([voiceBlob], `voice-${Date.now()}.webm`, { type: voiceBlob.type || "audio/webm" }),
            (progress) => {
              setUploadingMessages((prev) =>
                prev.map((item) =>
                  item.id === tempId
                    ? {
                        ...item,
                        uploadProgress: progress,
                      }
                    : item
                )
              );
            }
          );

          try {
            const created = await sendMessage({
              chatId: selectedChatId,
              type: "FILE",
              mediaUrl,
              content: voiceLabel,
              replyToId,
            });
            appendMessage(created);
          } finally {
            setUploadingMessages((prev) => prev.filter((item) => item.id !== tempId));
            URL.revokeObjectURL(objectUrl);
          }

          setReplyTo(null);
          return;
        }

        if (videoBlob) {
          const tempId = `video-${Date.now()}`;
          const objectUrl = URL.createObjectURL(videoBlob);
          const videoLabel = `Video clip${videoDurationSeconds ? ` (${videoDurationSeconds}s)` : ""}`;

          setUploadingMessages((prev) => [
            ...prev,
            {
              id: tempId,
              sender: "me",
              senderId: authUser?.id ?? "me",
              content: caption || videoLabel,
              text: caption || videoLabel,
              mediaUrl: objectUrl,
              messageType: "VIDEO",
              createdAt: new Date().toISOString(),
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              status: "sent",
              isUploading: true,
              uploadProgress: 10,
            },
          ]);

          const mediaUrl = await fileToDataUrlWithProgress(
            new File([videoBlob], `video-${Date.now()}.webm`, { type: videoBlob.type || "video/webm" }),
            (progress) => {
              setUploadingMessages((prev) =>
                prev.map((item) =>
                  item.id === tempId
                    ? {
                        ...item,
                        uploadProgress: progress,
                      }
                    : item
                )
              );
            }
          );

          try {
            const created = await sendMessage({
              chatId: selectedChatId,
              type: "VIDEO",
              mediaUrl,
              content: caption || undefined,
              replyToId,
            });
            appendMessage(created);
          } finally {
            setUploadingMessages((prev) => prev.filter((item) => item.id !== tempId));
            URL.revokeObjectURL(objectUrl);
          }

          setReplyTo(null);
          return;
        }

        if (files?.length) {
          const mediaPreset = getMediaPreset(mediaQuality);
          void mediaPreset.videoBitrateKbps;
          for (const [index, file] of files.entries()) {
            const messageType = toMessageType(file);
            const preparedFile =
              messageType === "IMAGE" ? await compressImage(file, mediaPreset) : file;
            const tempId = `upload-${Date.now()}-${index}-${preparedFile.name}`;
            const objectUrl = URL.createObjectURL(preparedFile);

            setUploadingMessages((prev) => [
              ...prev,
              {
                id: tempId,
                sender: "me",
                senderId: authUser?.id ?? "me",
                content: caption && index === 0 ? caption : preparedFile.name,
                text: caption && index === 0 ? caption : preparedFile.name,
                mediaUrl: objectUrl,
                messageType,
                createdAt: new Date().toISOString(),
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                status: "sent",
                isUploading: true,
                uploadProgress: 0,
              },
            ]);

            const mediaUrl = await fileToDataUrlWithProgress(preparedFile, (progress) => {
              setUploadingMessages((prev) =>
                prev.map((item) =>
                  item.id === tempId
                    ? {
                        ...item,
                        uploadProgress: progress,
                      }
                    : item
                )
              );
            });

            const content =
              caption && index === 0
                ? caption
                : messageType === "FILE"
                ? preparedFile.name
                : undefined;

            try {
              const created = await sendMessage({
                chatId: selectedChatId,
                type: messageType,
                mediaUrl,
                content,
                replyToId: index === 0 ? replyToId : undefined,
              });
              appendMessage(created);
            } finally {
              setUploadingMessages((prev) => prev.filter((item) => item.id !== tempId));
              URL.revokeObjectURL(objectUrl);
            }
          }
          setReplyTo(null);
          return;
        }

        if (caption) {
          await sendTextMessage(caption, replyToId);
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      appendMessage,
      authUser?.id,
      mediaQuality,
      selectedChatId,
      sendTextMessage,
      setReplyTo,
    ]
  );

  useAutoSendMessage({
    initialMessage,
    sendMessage: (text) => {
      void sendTextMessage(text, undefined);
    },
  });

  const startMultiSelect = useCallback((initialMessageId: string) => {
    if (!initialMessageId) return;
    const state = useChatStore.getState();
    state.enterMultiSelect(initialMessageId);
    setDeleteDialogOpen(false);
    setSelectionIntent("delete");
  }, []);

  const handleDeleteAction = useCallback(
    (messageId: string) => {
      startMultiSelect(messageId);
    },
    [startMultiSelect]
  );

  const handleCopyMessage = useCallback((_: string, text: string) => {
    if (!text) return;
    void navigator.clipboard?.writeText(text);
  }, []);

  const handleShareMessage = useCallback((messageId: string) => {
    setShareTarget({ messageId });
  }, []);

  const handleReplyMessage = useCallback(
    (messageId: string) => {
      const message = currentMessages.find((msg) => msg.id === messageId);
      if (!message) return;
      const senderName =
        message.senderId === authUser?.id
          ? "You"
          : selectedChat
          ? toChatListItem(selectedChat, authUser?.id).title
          : "User";
      setReplyTo({
        id: messageId,
        senderName,
        type: message.type,
        content: buildReplySnippet(message),
        mediaUrl: message.mediaUrl ?? undefined,
      });
    },
    [authUser?.id, currentMessages, selectedChat, setReplyTo]
  );

  const handleAskAi = useCallback(
    (messageId: string) => {
      if (!selectedChatId) return;
      void openAiPanel({ chatId: selectedChatId, targetMessageId: messageId });
    },
    [openAiPanel, selectedChatId]
  );

  const handleForwardMessage = useCallback((messageId: string) => {
    const target = currentMessages.find((item) => item.id === messageId);
    if (!target || target.deletedForEveryone) return;

    const state = useChatStore.getState();
    if (!state.isMultiSelect) {
      state.enterMultiSelect(messageId);
    } else {
      state.toggleMessageSelected(messageId);
    }
    setSelectionIntent("forward");
    setDeleteDialogOpen(false);
  }, [currentMessages]);

  const handleSaveMessageToMemory = useCallback(
    (messageId: string) => {
      if (!selectedChatId) return;
      void knowledgeActions.saveToMemory({
        chatId: selectedChatId,
        messageIds: [messageId],
        knowledgeType: "SUMMARY",
      });
    },
    [knowledgeActions, selectedChatId]
  );

  const handleSaveMessageToKnowledge = useCallback(
    (messageId: string) => {
      if (!selectedChatId) return;
      void knowledgeActions.saveToKnowledge({
        chatId: selectedChatId,
        messageIds: [messageId],
        knowledgeType: "SUMMARY",
      });
    },
    [knowledgeActions, selectedChatId]
  );

  const handleStarMessage = useCallback(
    (messageId: string) => {
      if (!selectedChatId || !messageId) return;
      setStarredMessageIdsByChat((prev) => {
        const chatStars = prev[selectedChatId] ?? {};
        const nextChatStars = { ...chatStars };
        if (nextChatStars[messageId]) {
          delete nextChatStars[messageId];
        } else {
          nextChatStars[messageId] = true;
        }
        return {
          ...prev,
          [selectedChatId]: nextChatStars,
        };
      });
    },
    [selectedChatId]
  );

  const handleReactMessage = useCallback(
    async (messageId: string, emoji: string) => {
      if (!selectedChatId || !emoji) return;
      const before =
        currentMessages.find((message) => message.id === messageId)?.reactionSummary ?? [];
      applyOptimisticReactionToggle(messageId, emoji);
      try {
        const result = await toggleMessageReaction(messageId, emoji);
        applyReactionSummary(messageId, result.summary);
      } catch (error) {
        applyReactionSummary(messageId, before);
        console.error("Failed to toggle reaction", error);
      }
    },
    [
      applyOptimisticReactionToggle,
      applyReactionSummary,
      currentMessages,
      selectedChatId,
    ]
  );

  const cancelSelectionMode = useCallback(() => {
    resetMultiSelect();
    setSelectionIntent(null);
    setDeleteDialogOpen(false);
  }, [resetMultiSelect]);

  const handlePrepareForwardSelection = useCallback(() => {
    const selectedIds = currentMessages
      .filter(
      (message) => Boolean(selectedMessageIds[message.id]) && !message.deletedForEveryone
      )
      .map((item) => item.id);
    if (selectedIds.length === 0) return;

    setPendingForwardMessageIds(selectedIds);
    setSelectedForwardChatIds({});
    setForwardPickerOpen(true);
    resetMultiSelect();
    setSelectionIntent(null);
  }, [currentMessages, resetMultiSelect, selectedMessageIds]);

  const handleConfirmForwardTargets = useCallback(async () => {
    const targetChatIds = Object.keys(selectedForwardChatIds);
    if (pendingForwardMessageIds.length === 0 || targetChatIds.length === 0 || isForwarding) return;

    setIsForwarding(true);
    await forwardMessagesApi({
      messageIds: pendingForwardMessageIds,
      targetChatIds,
    });
    setForwardPickerOpen(false);
    setPendingForwardMessageIds([]);
    setSelectedForwardChatIds({});
    setIsForwarding(false);
    const latestChats = await fetchChats();
    setChats(latestChats);
  }, [isForwarding, pendingForwardMessageIds, selectedForwardChatIds, setChats]);

  const selectedMessages = useMemo(
    () => currentMessages.filter((message) => Boolean(selectedMessageIds[message.id])),
    [currentMessages, selectedMessageIds]
  );

  const canDeleteForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.every((message) => {
      if (message.deletedForEveryone) return false;
      return message.senderId === authUser?.id;
    });

  const handleConfirmDelete = useCallback(
    async (scope: "ME" | "EVERYONE") => {
      const messageIds = Object.keys(selectedMessageIds);
      if (!selectedChatId || messageIds.length === 0) return;
      try {
        const result = await deleteMessages({ messageIds, scope });
        setDeleteDialogOpen(false);
        setSelectionIntent(null);
        resetMultiSelect();

        if (scope === "ME") {
          const ids = result.deletedMessageIds ?? result.successIds ?? [];
          if (ids.length > 0) {
            removeMessages(selectedChatId, ids);
          }
        } else {
          const deleted = result.deletedMessages ?? [];
          if (deleted.length > 0) {
            markMessagesDeletedForEveryone(
              selectedChatId,
              deleted.map((item) => item.id),
              {
                deletedById: authUser?.id,
                deletedAt: deleted[0]?.deletedAt ?? new Date().toISOString(),
              }
            );
          }
        }
      } catch (error) {
        console.error("Bulk delete failed", error);
      } finally {
        setDeleteDialogOpen(false);
        setSelectionIntent(null);
        resetMultiSelect();
      }
    },
    [
      authUser?.id,
      markMessagesDeletedForEveryone,
      removeMessages,
      resetMultiSelect,
      selectedChatId,
      selectedMessageIds,
    ]
  );

  const handleSelectionTrigger = useCallback(
    (messageId: string) => {
      if (!messageId) return false;
      const state = useChatStore.getState();
      if (!state.isMultiSelect) {
        startMultiSelect(messageId);
        return true;
      }
      state.toggleMessageSelected(messageId);
      return true;
    },
    [startMultiSelect]
  );

  const shareTargetsDirect = chats
    .filter((chat) => chat.id !== selectedChatId && chat.type === "DIRECT")
    .map((chat) => toChatListItem(chat, authUser?.id));
  const forwardTargets = chats
    .filter((chat) => chat.type !== "AI")
    .map((chat) => toChatListItem(chat, authUser?.id));

  const buildSharePayload = useCallback(
    (messageId: string): SharePayload | null => {
      const source = currentMessages.find((item) => item.id === messageId);
      if (!source) return null;
      return {
        content: source.content ?? undefined,
        mediaUrl: source.mediaUrl ?? undefined,
        type: source.type,
      };
    },
    [currentMessages]
  );

  const handleShareToChat = useCallback(
    async (targetChatId: string) => {
      if (!shareTarget) return;
      const payload = buildSharePayload(shareTarget.messageId);
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
    [buildSharePayload, setChats, shareTarget]
  );

  const handleShareToAi = useCallback(() => {
    if (!shareTarget) return;
    const payload = buildSharePayload(shareTarget.messageId);
    if (!payload) return;

    const shareText = [payload.content ?? "", payload.mediaUrl ?? ""].filter(Boolean).join("\n").trim();
    navigate(`/ai/${uuid()}`, {
      state: {
        initialMessage: shareText || "Shared from chat",
      },
    });
    setShareTarget(null);
  }, [buildSharePayload, navigate, shareTarget]);

  const handleShareToGroupPage = useCallback(() => {
    if (!shareTarget) return;
    const payload = buildSharePayload(shareTarget.messageId);
    if (!payload) return;

    navigate("/groups", {
      state: {
        activeSection: "groups",
        sharePayload: payload,
      },
    });
    setShareTarget(null);
  }, [buildSharePayload, navigate, shareTarget]);

  const handleOutsideShare = useCallback(async () => {
    if (!shareTarget) return;
    const payload = buildSharePayload(shareTarget.messageId);
    if (!payload) return;

    const shareText = [payload.content ?? "", payload.mediaUrl ?? ""].filter(Boolean).join("\n").trim();
    await shareMessage({
      title: "Euclit",
      text: shareText || "Shared from chat",
      url: /^https?:\/\//i.test(payload.mediaUrl ?? "") ? payload.mediaUrl : undefined,
    });
  }, [buildSharePayload, shareTarget]);

  if (!selectedChat || !selectedChatId) return null;

  const mappedChat = toChatListItem(selectedChat, authUser?.id);
  const account = {
    username: mappedChat.username,
    name: mappedChat.title,
    avatar: mappedChat.avatar || "",
  };

  const starredForSelectedChat =
    selectedChatId ? starredMessageIdsByChat[selectedChatId] ?? {} : {};
  const uiMessages = [
    ...currentMessages.map((message) => ({
      ...toUiMessage(message, authUser?.id),
      starred: Boolean(starredForSelectedChat[message.id]),
    })),
    ...uploadingMessages,
  ];
  const typingUserIds = selectedChatId ? typingUsersByChatId[selectedChatId] ?? [] : [];
  const typingNames = typingUserIds
    .map((userId) => selectedChat.participants.find((participant) => participant.userId === userId)?.user.name)
    .filter(Boolean) as string[];
  const typingText =
    typingNames.length === 0
      ? undefined
      : typingNames.length === 1
      ? `${typingNames[0]} is typing`
      : `${typingNames.slice(0, 2).join(", ")} are typing`;
  const isOnline = mappedChat.peerUserId ? onlineUsers.has(mappedChat.peerUserId) : false;

  return (
    <div className="flex h-full flex-col overflow-visible bg-gradient-to-b from-[#020617] via-zinc-950 to-[#020617] text-white">
      <ChatHeader
        account={account}
        typingText={typingText}
        isOnline={isOnline}
        chatId={selectedChatId}
        peerUserId={mappedChat.peerUserId}
      />

      {knowledgeActions.notice ? (
        <div className="px-3 pt-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            {knowledgeActions.notice}
          </div>
        </div>
      ) : null}
      {knowledgeActions.error ? (
        <div className="px-3 pt-3">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {knowledgeActions.error}
          </div>
        </div>
      ) : null}

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
              {selectionIntent === "forward" ? (
                <button
                  type="button"
                  onClick={handlePrepareForwardSelection}
                  disabled={Object.keys(selectedMessageIds).length === 0}
                  className="rounded-lg bg-sky-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={Object.keys(selectedMessageIds).length === 0}
                  className="rounded-lg bg-rose-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_8%,rgba(34,211,238,0.1),transparent_42%),radial-gradient(circle_at_15%_88%,rgba(16,185,129,0.08),transparent_40%)]" />
        <ChatMessages
          key={`chat-messages-${selectedChatId}-${selectionVersion}`}
          messages={uiMessages}
          selectionMode={isMultiSelect}
          selectedMessageIds={selectedMessageIds}
          onToggleMessageSelection={(id) => useChatStore.getState().toggleMessageSelected(id)}
          onSelectionTrigger={handleSelectionTrigger}
          onShareMessage={handleShareMessage}
          onDeleteMessage={(messageId) => {
            handleDeleteAction(messageId);
          }}
          onCopyMessage={handleCopyMessage}
          onReplyMessage={handleReplyMessage}
          onAskAiMessage={handleAskAi}
          onForwardMessage={handleForwardMessage}
          onStarMessage={handleStarMessage}
          onSaveToMemory={handleSaveMessageToMemory}
          onSaveToKnowledge={handleSaveMessageToKnowledge}
          onReactMessage={handleReactMessage}
          onToggleReaction={handleReactMessage}
          autoDownloadMedia={autoDownloadMedia}
        />
        <AiPanel chatId={selectedChatId} messages={currentMessages} />
      </div>

      <div className="border-t border-cyan-400/20 bg-zinc-950/85 backdrop-blur-xl">
        <ChatComposer
          onSend={handleSend}
          replyTo={replyTo ?? undefined}
          onCancelReply={() => setReplyTo(null)}
          onTypingStart={(activeChatId) => {
            if (!activeChatId) return;
            getSocket()?.emit("typing", { chatId: activeChatId });
          }}
          onTypingStop={(activeChatId) => {
            if (!activeChatId) return;
            getSocket()?.emit("stop_typing", { chatId: activeChatId });
          }}
          chatId={selectedChatId}
          maxFileSizeMB={20}
          maxAudioSeconds={180}
          isSending={isSending}
          enterToSend={enterToSend}
        />
      </div>

      {forwardPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Forward to chats/groups</h3>
              <button
                type="button"
                onClick={() => {
                  setForwardPickerOpen(false);
                  setPendingForwardMessageIds([]);
                  setSelectedForwardChatIds({});
                }}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {pendingForwardMessageIds.length} message(s) selected
            </div>

            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {forwardTargets.map((target) => {
                const checked = Boolean(selectedForwardChatIds[target.chatId]);
                return (
                  <button
                    key={target.chatId}
                    type="button"
                    onClick={() =>
                      setSelectedForwardChatIds((prev) => {
                        const next = { ...prev };
                        if (next[target.chatId]) {
                          delete next[target.chatId];
                        } else {
                          next[target.chatId] = true;
                        }
                        return next;
                      })
                    }
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      checked
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-zinc-800 bg-zinc-900/60 hover:border-indigo-500/60"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{target.title}</div>
                      <div className="text-xs text-zinc-400">
                        {target.type === "GROUP" ? "Group" : `@${target.username}`}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      className="h-4 w-4 accent-sky-500"
                    />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={Object.keys(selectedForwardChatIds).length === 0 || isForwarding}
              onClick={() => {
                void handleConfirmForwardTargets();
              }}
              className="mt-4 w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isForwarding ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {shareTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share message to</h3>
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Direct chats</div>
                <div className="space-y-2">
                  {shareTargetsDirect.map((target) => (
                    <button
                      key={`share-direct-${target.chatId}`}
                      type="button"
                      onClick={() => {
                        void handleShareToChat(target.chatId);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                    >
                      <div>
                        <div className="text-sm font-medium">{target.title}</div>
                        <div className="text-xs text-zinc-400">@{target.username}</div>
                      </div>
                      <span className="text-xs text-indigo-300">Share</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Groups</div>
                <button
                  type="button"
                  onClick={handleShareToGroupPage}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">Group page</div>
                    <div className="text-xs text-zinc-400">Choose group on Groups page</div>
                  </div>
                  <span className="text-xs text-indigo-300">Open</span>
                </button>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">AI</div>
                <button
                  type="button"
                  onClick={handleShareToAi}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">New AI chat</div>
                    <div className="text-xs text-zinc-400">Open with shared message</div>
                  </div>
                  <span className="text-xs text-indigo-300">Open</span>
                </button>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Outside share</div>
                <button
                  type="button"
                  onClick={() => {
                    void handleOutsideShare();
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">System share</div>
                    <div className="text-xs text-zinc-400">Share via other apps</div>
                  </div>
                  <span className="text-xs text-indigo-300">Open</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteDialogOpen && selectionIntent === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="text-base font-semibold">Delete messages</div>
            <div className="mt-1 text-xs text-zinc-400">{Object.keys(selectedMessageIds).length} selected</div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  void handleConfirmDelete("ME");
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-left hover:border-zinc-500"
              >
                Delete for me
              </button>
              {canDeleteForEveryone && (
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirmDelete("EVERYONE");
                  }}
                  className="w-full rounded-xl border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm text-left text-rose-200 hover:border-rose-500"
                >
                  Delete for everyone
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={cancelSelectionMode}
              className="mt-4 w-full rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
