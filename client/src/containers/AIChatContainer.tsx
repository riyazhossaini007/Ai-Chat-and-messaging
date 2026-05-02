import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AiChatHeader from "../components/AIChatComponents/AiChatHeader";
import AiMessages from "../components/AIChatComponents/AiMessages";
import AiChatInput from "../components/AIChatComponents/AiChatInput";
import type { AiMessage, AiModel } from "../components/AIChatComponents/AItypes";
import AiMemoryPanel from "../components/ai/AiMemoryPanel";
import { shareMessage } from "../utils/shareMessage";
import {
  cancelAiChatStream,
  createAiChatCompletionStream,
  fetchAiModelConfig,
  type AiRole,
} from "../api/ai.api";
import { getApiErrorMessage } from "../api/api";
import {
  clearPendingAiDraft,
  getAiSessionById,
  getPendingAiDraft,
  upsertAiSession,
} from "../utils/aiSessionStorage";
import { fetchChats } from "../api/chat.api";
import { sendMessage } from "../api/message.api";
import { toChatListItem, useChatStore } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";
import { useAiMemory } from "../hooks/useAiMemory";

type AiContainerProps = {
  chatId?: string;
  initialMessage?: string;
  autoSendInitial?: boolean;
  onSessionMetaChange?: (meta: { id: string; title: string; updatedAt: string }) => void;
  onCreateChatFromDraft?: (initialMessage: string) => void;
};

const FALLBACK_MODELS: AiModel[] = ["openrouter", "openai", "claude", "gemini", "grok"];
const FALLBACK_SELECTIONS = [
  "openrouter:plaxe-o1",
  "openai:gpt-4.1-mini",
  "claude:claude-3-5-sonnet-latest",
  "gemini:gemini-1.5-flash",
  "grok:grok-2-latest",
];
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 512;
const MAX_CONTEXT_MESSAGES = 20;

const PAYWALL_TEXT = "Locked models require credits. Upgrade your plan or buy credits to use OpenAI, Claude, Gemini, and Grok.";

const getDefaultSelection = (): string => {
  const stored = localStorage.getItem("plaxeai_default_model_selection");
  if (stored && stored.includes(":")) {
    return stored;
  }
  return FALLBACK_SELECTIONS[0];
};

const parseSelection = (value: string) => {
  const [provider, ...rest] = value.split(":");
  const version = rest.join(":");
  const normalizedProvider = (
    provider === "openrouter" ||
    provider === "openai" ||
    provider === "claude" ||
    provider === "gemini" ||
    provider === "grok"
      ? provider
      : "openrouter"
  ) as AiModel;
  return {
    provider: normalizedProvider,
    version,
  };
};

const buildFallbackModelOptions = () =>
  FALLBACK_SELECTIONS.map((id) => {
    const parsed = parseSelection(id);
    return {
      id,
      provider: parsed.provider,
      version: parsed.version,
      label: `${parsed.version}`,
      free: parsed.provider === "openrouter",
      locked: parsed.provider !== "openrouter",
    };
  });

export default function AiContainer({
  chatId,
  initialMessage,
  autoSendInitial = false,
  onSessionMetaChange,
  onCreateChatFromDraft,
}: AiContainerProps) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [modelSelection, setModelSelection] = useState<string>(getDefaultSelection());
  const [modelOptions, setModelOptions] = useState<
    Array<{ id: string; provider: AiModel; version: string; label: string; free: boolean; locked: boolean }>
  >(buildFallbackModelOptions);
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({});
  const [modelCooldownUntil, setModelCooldownUntil] = useState<Partial<Record<AiModel, number>>>(
    {}
  );
  const [, setRemainingCredits] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRouteTransitionSending, setIsRouteTransitionSending] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [forwardInAppMessage, setForwardInAppMessage] = useState<{ id: string; content: string } | null>(
    null
  );
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [isLoadingForwardTargets, setIsLoadingForwardTargets] = useState(false);
  const [sendingForwardToChatId, setSendingForwardToChatId] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState("");
  const [lastAttemptPayload, setLastAttemptPayload] = useState<{
    prompt: string;
    sourceUserMessageId?: string;
    regeneratedFromRequestId?: string;
    appendUserMessage: boolean;
  } | null>(null);
  const autoSentChatIdRef = useRef<string | null>(null);
  const authUser = useAuthStore((store) => store.user);
  const chats = useChatStore((store) => store.chats);
  const setChats = useChatStore((store) => store.setChats);
  const memory = useAiMemory();

  const selectedProvider = parseSelection(modelSelection).provider;
  const isModelCoolingDown = (candidate: AiModel) => (modelCooldownUntil[candidate] ?? 0) > Date.now();
  const selectedOption = modelOptions.find((item) => item.id === modelSelection);
  const selectionGroups = useMemo(
    () =>
      FALLBACK_MODELS.map((provider) => ({
        provider,
        providerLabel: modelLabels[provider] ?? provider.toUpperCase(),
        options: modelOptions
          .filter((item) => item.provider === provider)
          .map((item) => ({
            id: item.id,
            label: item.label,
            locked: item.locked,
            disabled: isModelCoolingDown(item.provider),
          })),
      })).filter((group) => group.options.length > 0),
    [isModelCoolingDown, modelLabels, modelOptions]
  );

  const quickPrompts = useMemo(
    () => [
      "Summarize this meeting in 5 bullets",
      "Write a clean product launch email",
      "Create a weekly study plan",
      "Debug this TypeScript error step by step",
    ],
    []
  );
  const forwardTargets = useMemo(
    () =>
      chats
        .filter((chat) => chat.type !== "AI")
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chats]
  );

  const appendPaywallMessage = useCallback(() => {
    const paywallMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: "ai",
      type: "text",
      content: PAYWALL_TEXT,
      kind: "paywall",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, paywallMessage]);
  }, []);

  const appendProviderDegradedMessage = useCallback(
    (suggestedModels: AiModel[]) => {
      const providerMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: "ai",
        type: "text",
        kind: "degraded",
        suggestedModels,
        content: "Selected model is currently experiencing issues (high latency/errors). Choose another model to continue.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, providerMessage]);
    },
    []
  );

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    const stored = getAiSessionById(chatId);
    if (stored && stored.messages.length > 0) {
      setMessages(stored.messages);
      onSessionMetaChange?.({
        id: stored.id,
        title: stored.title,
        updatedAt: stored.updatedAt,
      });
      return;
    }

    if (initialMessage?.trim()) {
      if (autoSendInitial) {
        return;
      }
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "user",
          type: "text",
          content: initialMessage.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }
  }, [autoSendInitial, chatId, initialMessage, onSessionMetaChange]);

  useEffect(() => {
    if (!chatId) return;
    if (messages.length === 0) return;

    const existingSession = getAiSessionById(chatId);
    const firstUserMessage = messages.find(
      (message) => message.role === "user" && message.type === "text" && message.content.trim().length > 0
    );
    const derivedTitle = firstUserMessage ? firstUserMessage.content.trim().slice(0, 48) : "New AI Chat";
    const title = existingSession?.title?.trim() ? existingSession.title : derivedTitle;
    const updatedAt = new Date().toISOString();

    upsertAiSession({
      id: chatId,
      title,
      updatedAt,
      messages,
    });
    onSessionMetaChange?.({
      id: chatId,
      title,
      updatedAt,
    });
  }, [chatId, messages, onSessionMetaChange]);

  const refreshModelConfig = useCallback(async () => {
    try {
      const config = await fetchAiModelConfig();
      const nextSelections =
        config.modelSelections.length > 0
          ? config.modelSelections
          : buildFallbackModelOptions();
      setModelOptions(nextSelections);
      setModelLabels(config.modelLabels ?? {});
      setSubscriptionActive(Boolean(config.subscriptionActive));
      setRemainingCredits(config.billing?.credits?.remainingCredits ?? 0);
      setModelSelection((current) => {
        const currentOption = nextSelections.find((item) => item.id === current);
        if (currentOption && !currentOption.locked) {
          return current;
        }
        const nextDefault =
          config.defaultSelection ||
          nextSelections.find((item) => !item.locked)?.id ||
          nextSelections[0]?.id ||
          FALLBACK_SELECTIONS[0];
        localStorage.setItem("plaxeai_default_model_selection", nextDefault);
        return nextDefault;
      });
    } catch {
      setModelOptions(
        buildFallbackModelOptions()
      );
      setModelLabels({});
      setSubscriptionActive(false);
      setRemainingCredits(0);
      setModelSelection(FALLBACK_SELECTIONS[0]);
    }
  }, []);

  useEffect(() => {
    void refreshModelConfig();
  }, [refreshModelConfig]);

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

  useEffect(() => {
    const hasActive = Object.values(modelCooldownUntil).some((value) => (value ?? 0) > Date.now());
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      setModelCooldownUntil((prev) => ({ ...prev }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [modelCooldownUntil]);

  const handleShareMessage = useCallback(async (_: string, content: string) => {
    if (!content) return;
    await shareMessage({ title: "Euclit", text: content });
  }, []);

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

  const handlePinMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, isPinned: !message.isPinned } : message
      )
    );
  }, []);

  const appendErrorMessage = useCallback((content: string) => {
    const errorMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: "ai",
      type: "text",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  }, []);

  const createApiMessages = useCallback(
    (inputMessages: AiMessage[], extraUserMessage?: string) => {
      const fromTimeline = inputMessages
        .filter(
          (message) =>
            message.type === "text" &&
            message.kind !== "paywall" &&
            message.content.trim().length > 0
        )
        .map((message) => ({
          role: (message.role === "user" ? "user" : "assistant") as AiRole,
          content: message.content,
        }));

      const withExtra = extraUserMessage?.trim()
        ? [...fromTimeline, { role: "user" as const, content: extraUserMessage.trim() }]
        : fromTimeline;
      return withExtra.slice(-MAX_CONTEXT_MESSAGES);
    },
    []
  );

  const runAssistantReply = useCallback(
    async (input: {
      prompt: string;
      appendUserMessage: boolean;
      sourceUserMessageId?: string;
      regeneratedFromRequestId?: string;
    }) => {
      if (isGenerating) return;

      const fallbackUnlocked = modelOptions.find((item) => !item.locked);
      const resolvedSelection =
        selectedOption && !selectedOption.locked
          ? selectedOption.id
          : (fallbackUnlocked?.id ?? modelSelection);
      const resolvedProvider = parseSelection(resolvedSelection).provider;

      if (isModelCoolingDown(resolvedProvider)) {
        const waitMs = (modelCooldownUntil[resolvedProvider] ?? 0) - Date.now();
        appendErrorMessage(`Try again in ${Math.max(1, Math.ceil(waitMs / 1000))}s.`);
        return;
      }

      if (selectedOption?.locked && fallbackUnlocked) {
        setModelSelection(fallbackUnlocked.id);
        localStorage.setItem("plaxeai_default_model_selection", fallbackUnlocked.id);
      }

      if (selectedOption?.locked && !fallbackUnlocked) {
        appendPaywallMessage();
        return;
      }

      if (!chatId) {
        onCreateChatFromDraft?.(input.prompt || "(file attachment)");
        return;
      }

      const outgoingUser: AiMessage | null = input.appendUserMessage
        ? {
            id: crypto.randomUUID(),
            role: "user",
            type: "text",
            content: input.prompt,
            createdAt: new Date().toISOString(),
          }
        : null;

      const assistantId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const assistantPlaceholder: AiMessage = {
        id: assistantId,
        role: "ai",
        type: "text",
        content: "",
        modelUsed: resolvedProvider,
        sourceUserMessageId: input.sourceUserMessageId,
        createdAt: new Date().toISOString(),
      };

      const apiMessages = createApiMessages(messages, input.prompt);

      setMessages((prev) => [...prev, ...(outgoingUser ? [outgoingUser] : []), assistantPlaceholder]);
      setIsGenerating(true);
      setActiveRequestId(requestId);
      setLastAttemptPayload({
        prompt: input.prompt,
        sourceUserMessageId: input.sourceUserMessageId,
        regeneratedFromRequestId: input.regeneratedFromRequestId,
        appendUserMessage: input.appendUserMessage,
      });
      void memory.search({ q: input.prompt, limit: 5 });

      try {
        await createAiChatCompletionStream(
          {
            requestId,
            regeneratedFromRequestId: input.regeneratedFromRequestId,
            model: resolvedSelection,
            temperature: DEFAULT_TEMPERATURE,
            maxTokens: DEFAULT_MAX_TOKENS,
            messages: apiMessages,
          },
          {
            onToken: (token) => {
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantId ? { ...item, content: `${item.content}${token}` } : item
                )
              );
            },
            onDone: (reply) => {
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantId
                    ? {
                        ...item,
                        content:
                          item.content ||
                          (reply.switchedFromModel && reply.switchedToModel
                            ? `Switched to ${reply.switchedToModel.toUpperCase()} due to ${reply.switchedFromModel.toUpperCase()} downtime.\n\n${reply.text}`
                            : reply.text),
                        modelUsed: reply.model ?? resolvedProvider,
                        switchedFromModel: reply.switchedFromModel ?? undefined,
                        switchedToModel: reply.switchedToModel ?? undefined,
                        sourceUserMessageId:
                          input.sourceUserMessageId ??
                          outgoingUser?.id ??
                          item.sourceUserMessageId,
                      }
                    : item
                )
              );
            },
            onCancelled: () => {
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantId
                    ? {
                        ...item,
                        content: item.content.trim().length > 0 ? item.content : "Cancelled.",
                      }
                    : item
                )
              );
            },
          }
        );
        void refreshModelConfig();
      } catch (error) {
        const message = getApiErrorMessage(error);
        setMessages((prev) => prev.filter((item) => item.id !== assistantId));
        if (message.includes("CREDITS_REQUIRED") || message.includes("Buy credits")) {
          appendPaywallMessage();
          void refreshModelConfig();
          return;
        }
        if (message.includes("MODEL_NOT_ALLOWED")) {
          appendPaywallMessage();
          return;
        }
        if (message.startsWith("MODEL_COOLDOWN:")) {
          const rawMs = Number(message.split(":")[1] ?? "0");
          const waitMs = Number.isFinite(rawMs) ? Math.max(0, rawMs) : 0;
          setModelCooldownUntil((prev) => ({ ...prev, [resolvedProvider]: Date.now() + waitMs }));
          appendErrorMessage(`Try again in ${Math.max(1, Math.ceil(waitMs / 1000))}s.`);
          return;
        }
        if (message.startsWith("PROVIDER_DEGRADED:")) {
          const suggested = message
            .slice("PROVIDER_DEGRADED:".length)
            .split(",")
            .map((item) => item.trim())
            .filter(
              (item) =>
                item === "openrouter" ||
                item === "openai" ||
                item === "claude" ||
                item === "gemini" ||
                item === "grok"
            ) as AiModel[];
          appendProviderDegradedMessage(suggested);
          return;
        }
        appendErrorMessage(`Error: ${message}`);
      } finally {
        setIsGenerating(false);
        setActiveRequestId(null);
      }
    },
    [
      appendErrorMessage,
      appendPaywallMessage,
      chatId,
      createApiMessages,
      isGenerating,
      messages,
      modelSelection,
      modelCooldownUntil,
      selectedOption?.locked,
      selectedProvider,
      subscriptionActive,
      memory,
      onCreateChatFromDraft,
      refreshModelConfig,
    ]
  );

  const handleSend = useCallback(
    async ({ text, mode, files }: { text: string; mode: "text" | "image"; files: File[] }) => {
      const trimmed = text.trim();
      if (!trimmed && files.length === 0) return;

      const userText =
        mode === "image" ? `Generate an image with this prompt:\n${trimmed}` : trimmed;
      const withAttachments =
        files.length > 0
          ? `${userText}\n\n[Attached files: ${files.map((file) => file.name).join(", ")}]`
          : userText;

      await runAssistantReply({
        prompt: withAttachments || "(file attachment)",
        appendUserMessage: true,
      });
    },
    [runAssistantReply]
  );

  useEffect(() => {
    if (!chatId) return;
    if (autoSentChatIdRef.current === chatId) return;
    const routeDraft = initialMessage?.trim() ?? "";
    const pendingDraft = getPendingAiDraft(chatId);
    const draft = routeDraft || pendingDraft;
    if (!draft) return;
    setIsRouteTransitionSending(true);
    autoSentChatIdRef.current = chatId;
    void handleSend({ text: draft, mode: "text", files: [] }).finally(() => {
      clearPendingAiDraft(chatId);
      setIsRouteTransitionSending(false);
    });
  }, [chatId, handleSend, initialMessage]);

  const effectiveGenerating = isGenerating || isRouteTransitionSending;

  const handleCancel = useCallback(async () => {
    if (!activeRequestId) return;
    try {
      await cancelAiChatStream(activeRequestId);
    } catch (error) {
      appendErrorMessage(`Error: ${getApiErrorMessage(error)}`);
      setIsGenerating(false);
      setActiveRequestId(null);
    }
  }, [activeRequestId, appendErrorMessage]);

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (isGenerating) return;
      const index = messages.findIndex((item) => item.id === messageId);
      if (index < 0) return;
      const target = messages[index];
      if (target.role !== "ai" || target.kind === "paywall") return;

      let sourceUser =
        target.sourceUserMessageId &&
        messages.find((item) => item.id === target.sourceUserMessageId && item.role === "user");
      if (!sourceUser) {
        for (let i = index - 1; i >= 0; i -= 1) {
          if (messages[i].role === "user" && messages[i].type === "text") {
            sourceUser = messages[i];
            break;
          }
        }
      }
      if (!sourceUser) return;

      await runAssistantReply({
        prompt: sourceUser.content,
        appendUserMessage: false,
        sourceUserMessageId: sourceUser.id,
        regeneratedFromRequestId: target.id,
      });
    },
    [isGenerating, messages, runAssistantReply]
  );

  const handleDismissPaywallMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
  }, []);

  return (
    <div
      className="
      relative h-full w-full flex flex-col
      bg-[radial-gradient(circle_at_15%_15%,rgba(20,184,166,0.18),transparent_42%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.16),transparent_34%),linear-gradient(to_bottom,#020617,#020617,#000000)]
      text-zinc-100
      overflow-hidden
    "
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.5)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20" />

      <div className="relative z-[180] overflow-visible border-b border-white/10 bg-slate-950/65 backdrop-blur-xl">
        <AiChatHeader
          modelSelection={modelSelection}
          modelTitle={
            selectedOption
              ? `${modelLabels[selectedOption.provider] ?? selectedOption.provider.toUpperCase()} - ${selectedOption.version}`
              : undefined
          }
          selectionGroups={selectionGroups}
          onModelChange={(nextSelection) => {
            const next = modelOptions.find((item) => item.id === nextSelection);
            if (next?.locked) {
              appendPaywallMessage();
              return;
            }
            setModelSelection(nextSelection);
            localStorage.setItem("plaxeai_default_model_selection", nextSelection);
          }}
        />
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden px-2 md:px-6">
        <AiMessages
          messages={messages}
          isGenerating={effectiveGenerating}
          quickPrompts={quickPrompts}
          onPromptSelect={(prompt) => {
            void handleSend({ text: prompt, mode: "text", files: [] });
          }}
          onShareMessage={handleShareMessage}
          onCopyMessage={handleCopyMessage}
          onReactMessage={handleReactMessage}
          onForwardInAppMessage={handleForwardInAppMessage}
          onForwardOutsideMessage={handleForwardOutsideMessage}
          onPinMessage={handlePinMessage}
          onRegenerateMessage={(messageId) => {
            void handleRegenerate(messageId);
          }}
          onDismissPaywallMessage={handleDismissPaywallMessage}
          onSelectSuggestedModel={(nextModel) => {
            const next = modelOptions.find((item) => item.provider === nextModel && !item.locked);
            if (!next) {
              appendPaywallMessage();
              return;
            }
            setModelSelection(next.id);
            localStorage.setItem("plaxeai_default_model_selection", next.id);
          }}
          onRetryCurrentModel={() => {
            if (!lastAttemptPayload) return;
            void runAssistantReply(lastAttemptPayload);
          }}
        />

        <div className="pointer-events-none absolute right-2 top-4 hidden w-80 lg:block">
          <div className="pointer-events-auto">
            <AiMemoryPanel
              items={memory.items}
              loading={memory.loading}
              error={memory.error}
              onPin={(memoryId) => {
                void memory.togglePin(memoryId);
              }}
              onForget={(memoryId) => {
                void memory.forget(memoryId);
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-slate-950/55 px-3 py-3 lg:hidden">
        <AiMemoryPanel
          items={memory.items}
          loading={memory.loading}
          error={memory.error}
          onPin={(memoryId) => {
            void memory.togglePin(memoryId);
          }}
          onForget={(memoryId) => {
            void memory.forget(memoryId);
          }}
        />
      </div>

      <div
        className="
        relative border-t border-white/10
        bg-slate-950/65 backdrop-blur-xl
      "
      >
        <AiChatInput
          disabled={effectiveGenerating}
          isGenerating={effectiveGenerating}
          onCancel={() => {
            void handleCancel();
          }}
          onSend={handleSend}
        />
      </div>

      {forwardPickerOpen && forwardInAppMessage && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
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
                    key={`forward-ai-target-${target.chatId}`}
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


