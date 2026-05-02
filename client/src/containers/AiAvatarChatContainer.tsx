import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AiMessages from "../components/AIChatComponents/AiMessages";
import AiChatInput from "../components/AIChatComponents/AiChatInput";
import type { AiMessage } from "../components/AIChatComponents/AItypes";
import type { AiAvatar } from "../components/sidebarComponents/aiAvatars";
import { shareMessage } from "../utils/shareMessage";
import { fetchChats } from "../api/chat.api";
import { sendMessage } from "../api/message.api";
import { toChatListItem, useChatStore } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";

type AiAvatarChatContainerProps = {
  avatar: AiAvatar;
};

export default function AiAvatarChatContainer({
  avatar,
}: AiAvatarChatContainerProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AiMessage[]>([
  ]);
  const [forwardInAppMessage, setForwardInAppMessage] = useState<{ id: string; content: string } | null>(
    null
  );
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [isLoadingForwardTargets, setIsLoadingForwardTargets] = useState(false);
  const [sendingForwardToChatId, setSendingForwardToChatId] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState("");
  const authUser = useAuthStore((store) => store.user);
  const chats = useChatStore((store) => store.chats);
  const setChats = useChatStore((store) => store.setChats);

  const header = useMemo(
    () => ({
      name: avatar.name,
      role: avatar.role ?? "AI Avatar",
      avatarUrl: avatar.avatarUrl,
    }),
    [avatar]
  );
  const forwardTargets = useMemo(
    () =>
      chats
        .filter((chat) => chat.type !== "AI")
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chats]
  );

  const handleShareMessage = useCallback(async (_: string, content: string) => {
    if (!content) return;
    await shareMessage({ title: "Euclit", text: content });
  }, []);

  useEffect(() => {
    if (!forwardPickerOpen) return;
    let alive = true;
    setIsLoadingForwardTargets(true);
    setForwardError("");
    void fetchChats()
      .then((data) => {
        if (!alive) return;
        setChats(data);
      })
      .catch(() => {
        if (!alive) return;
        setForwardError("Could not load chats.");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoadingForwardTargets(false);
      });
    return () => {
      alive = false;
    };
  }, [forwardPickerOpen, setChats]);

  const handleCopyMessage = useCallback((_: string, content: string) => {
    if (!content) return;
    navigator.clipboard?.writeText(content);
  }, []);

  const handleReactMessage = useCallback((messageId: string, type: "LIKE" | "DISLIKE") => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;
        const nextReaction = message.reaction === type ? null : type;
        return { ...message, reaction: nextReaction };
      })
    );
  }, []);

  const handlePinMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, isPinned: !message.isPinned } : message
      )
    );
  }, []);

  const handleForwardInAppMessage = useCallback((messageId: string, content: string) => {
    if (!content) return;
    setForwardInAppMessage({ id: messageId, content });
    setForwardError("");
    setForwardPickerOpen(true);
  }, []);

  const handleForwardOutsideMessage = useCallback(async (_: string, content: string) => {
    if (!content) return;
    await shareMessage({ title: "Euclit", text: content });
  }, []);

  const handleForwardToChat = useCallback(async (targetChatId: string) => {
    if (!forwardInAppMessage || !targetChatId) return;
    setSendingForwardToChatId(targetChatId);
    setForwardError("");
    try {
      await sendMessage({
        chatId: targetChatId,
        type: "TEXT",
        content: forwardInAppMessage.content,
      });
      setForwardPickerOpen(false);
      setForwardInAppMessage(null);
    } catch {
      setForwardError("Could not forward to this chat.");
    } finally {
      setSendingForwardToChatId(null);
    }
  }, [forwardInAppMessage]);

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/60 backdrop-blur bg-zinc-950/80 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/ai")}
          className="h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900/60 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="h-10 w-10 rounded-full overflow-hidden border border-zinc-700 bg-zinc-900">
          <img src={header.avatarUrl} alt={header.name} className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="text-sm font-semibold">{header.name}</div>
          <div className="text-xs text-zinc-400">{header.role}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden px-2 md:px-6">
        <AiMessages
          messages={messages}
          onShareMessage={handleShareMessage}
          onCopyMessage={handleCopyMessage}
          onReactMessage={handleReactMessage}
          onForwardInAppMessage={handleForwardInAppMessage}
          onForwardOutsideMessage={handleForwardOutsideMessage}
          onPinMessage={handlePinMessage}
        />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
        <AiChatInput
          onSend={({ text, mode, files }) => {
            console.log(text, mode, files);
          }}
        />
      </div>

      {forwardPickerOpen && forwardInAppMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Forward in app</h3>
              <button
                type="button"
                onClick={() => {
                  setForwardPickerOpen(false);
                  setForwardInAppMessage(null);
                  setForwardError("");
                }}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-1 text-xs text-zinc-400 line-clamp-2">{forwardInAppMessage.content}</div>
            {forwardError && <div className="mt-2 text-xs text-rose-300">{forwardError}</div>}

            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {isLoadingForwardTargets && <div className="text-sm text-zinc-300">Loading chats...</div>}
              {!isLoadingForwardTargets && forwardTargets.length === 0 && (
                <div className="text-sm text-zinc-400">No chats or groups available.</div>
              )}
              {!isLoadingForwardTargets &&
                forwardTargets.map((target) => (
                  <button
                    key={`forward-avatar-target-${target.chatId}`}
                    type="button"
                    disabled={Boolean(sendingForwardToChatId)}
                    onClick={() => {
                      void handleForwardToChat(target.chatId);
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
                      {sendingForwardToChatId === target.chatId ? "Sending..." : "Forward"}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
