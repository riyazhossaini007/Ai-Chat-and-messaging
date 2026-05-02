import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import {
  forwardAiTurn,
  respondWithContext,
  shareAiTurnToChat,
  type AiTurnRecord,
} from "../../api/ai.api";
import type { AiResponseSourceRecord } from "../../api/types";
import AiResponseSources from "../ai/AiResponseSources";
import type { AiMessage } from "../AIChatComponents/AItypes";
import { useAiThreadStore } from "../../stores/aiThreadStore";
import { toChatListItem, useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { upsertAiSession } from "../../utils/aiSessionStorage";
import { useKnowledgeActions } from "../../hooks/useKnowledgeActions";

type AiTargetMessage = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  deletedForEveryone?: boolean;
};

type AiPanelProps = {
  chatId: string;
  messages: AiTargetMessage[];
};

const commandPrompts = [
  { label: "Summarize", prompt: "@ai summarize it", command: "SUMMARIZE" as const },
  { label: "Explain", prompt: "@ai explain this", command: "EXPLAIN" as const },
  { label: "Translate", prompt: "@ai translate to Bengali", command: "TRANSLATE" as const },
];

const latestAiTurn = (turns: AiTurnRecord[]) =>
  [...turns].reverse().find((turn) => turn.role === "AI");

const THREAD_SESSION_MAP_KEY = "plaxeai_ai_thread_session_map";

const readThreadSessionMap = (): Record<string, string> => {
  const raw = localStorage.getItem(THREAD_SESSION_MAP_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, string> = {};
    for (const [threadId, sessionId] of Object.entries(parsed)) {
      if (typeof threadId !== "string" || typeof sessionId !== "string") continue;
      if (!threadId.trim() || !sessionId.trim()) continue;
      next[threadId] = sessionId;
    }
    return next;
  } catch {
    return {};
  }
};

const getOrCreateSessionIdForThread = (threadId: string) => {
  const map = readThreadSessionMap();
  const existing = map[threadId];
  if (existing) return existing;
  const created = uuid();
  localStorage.setItem(
    THREAD_SESSION_MAP_KEY,
    JSON.stringify({
      ...map,
      [threadId]: created,
    })
  );
  return created;
};

export default function AiPanel({ chatId, messages }: AiPanelProps) {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const chats = useChatStore((state) => state.chats);
  const aiPanelOpen = useAiThreadStore((state) => state.aiPanelOpen);
  const activeThreadId = useAiThreadStore((state) => state.activeThreadId);
  const targetMessageId = useAiThreadStore((state) => state.targetMessageId);
  const turnsByThreadId = useAiThreadStore((state) => state.turnsByThreadId);
  const closePanel = useAiThreadStore((state) => state.closePanel);
  const sendTurn = useAiThreadStore((state) => state.sendTurn);
  const knowledgeActions = useKnowledgeActions();

  const [prompt, setPrompt] = useState("");
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTargetChatId, setForwardTargetChatId] = useState<string>("");
  const [busyAction, setBusyAction] = useState<"share" | "forward" | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextReply, setContextReply] = useState<string>("");
  const [contextSources, setContextSources] = useState<AiResponseSourceRecord[]>([]);

  const turns = activeThreadId ? turnsByThreadId[activeThreadId] ?? [] : [];
  const targetMessage = useMemo(
    () => messages.find((message) => message.id === targetMessageId),
    [messages, targetMessageId]
  );
  const latestAi = latestAiTurn(turns);
  const forwardTargets = useMemo(
    () =>
      chats
        .filter((chat) => chat.id !== chatId && chat.type !== "AI")
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chatId, chats]
  );

  if (!aiPanelOpen || !targetMessageId) return null;

  const targetPreview = targetMessage
    ? targetMessage.deletedForEveryone
      ? "Target message not available"
      : targetMessage.content || targetMessage.mediaUrl || targetMessage.type
    : "Target message not available";

  const onSend = async () => {
    const value = prompt.trim();
    if (!value) return;
    setPrompt("");
    await sendTurn(value);
  };

  const onChip = async (chip: (typeof commandPrompts)[number]) => {
    await sendTurn(chip.prompt, chip.command);
  };

  const onCopy = async () => {
    if (!latestAi?.content) return;
    await navigator.clipboard?.writeText(latestAi.content);
  };

  const onShare = async () => {
    if (!activeThreadId || !latestAi) return;
    setBusyAction("share");
    try {
      await shareAiTurnToChat(activeThreadId, latestAi.id);
    } finally {
      setBusyAction(null);
    }
  };

  const onForward = async () => {
    if (!activeThreadId || !latestAi || !forwardTargetChatId) return;
    setBusyAction("forward");
    try {
      await forwardAiTurn(activeThreadId, { aiTurnId: latestAi.id, toChatId: forwardTargetChatId });
      setForwardOpen(false);
      setForwardTargetChatId("");
    } finally {
      setBusyAction(null);
    }
  };

  const runContextAnswer = async () => {
    const query = prompt.trim();
    if (!query) return;
    setContextLoading(true);
    setContextError(null);
    try {
      const result = await respondWithContext({
        chatId,
        selectedMessageId: targetMessageId,
        query,
        mode: "ANSWER_QUESTION",
      });
      setContextReply(result.reply.text);
      setContextSources(result.sourcesUsed);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : "Could not build a source-linked answer.");
      setContextReply("");
      setContextSources([]);
    } finally {
      setContextLoading(false);
    }
  };

  const saveSelectedMessageToMemory = () => {
    void knowledgeActions.saveToMemory({
      chatId,
      messageIds: [targetMessageId],
      knowledgeType: "SUMMARY",
    });
  };

  const saveSelectedMessageToKnowledge = () => {
    void knowledgeActions.saveToKnowledge({
      chatId,
      messageIds: [targetMessageId],
      knowledgeType: "SUMMARY",
    });
  };

  const saveLatestAnswerToMemory = () => {
    if (!latestAi?.content) return;
    void knowledgeActions.saveToMemory({
      chatId,
      messageIds: [targetMessageId],
      title: latestAi.content.slice(0, 120),
      summary: latestAi.content.slice(0, 400),
      knowledgeType: "SUMMARY",
    });
  };

  const saveLatestAnswerToKnowledge = () => {
    if (!latestAi?.content) return;
    void knowledgeActions.saveToKnowledge({
      chatId,
      messageIds: [targetMessageId],
      title: latestAi.content.slice(0, 120),
      summary: latestAi.content.slice(0, 400),
      knowledgeType: "SUMMARY",
    });
  };

  const openInAiChatPage = () => {
    if (!activeThreadId) return;

    const sessionId = getOrCreateSessionIdForThread(activeThreadId);
    const normalizedMessages: AiMessage[] = turns
      .filter((turn) => turn.content.trim().length > 0)
      .filter((turn) => !(turn.role === "AI" && turn.content.trim() === "Thinking..."))
      .map((turn) => ({
        id: turn.id,
        role: turn.role === "USER" ? "user" : "ai",
        type: "text",
        content: turn.content,
        createdAt: turn.createdAt,
      }));

    const firstUserTurn = normalizedMessages.find((item) => item.role === "user");
    const fallbackTitle = targetPreview.trim().slice(0, 48);
    const title = (firstUserTurn?.content || fallbackTitle || "Ask AI Thread").slice(0, 48);
    const updatedAt = new Date().toISOString();

    upsertAiSession({
      id: sessionId,
      title,
      updatedAt,
      messages: normalizedMessages,
    });

    navigate(`/ai/${sessionId}`);
  };

  return (
    <div className="absolute bottom-2 left-2 right-2 z-30 overflow-hidden rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-zinc-950/95 via-zinc-950/92 to-[#03232a]/90 p-4 shadow-[0_30px_80px_-45px_rgba(34,211,238,0.7)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Assistant Thread</div>
          <div className="text-sm font-semibold text-cyan-100">Ask AI about selected message</div>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="rounded-lg border border-zinc-700/80 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="mb-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 px-3 py-2">
        <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300/70">Selected message</div>
        <div className="line-clamp-2 text-xs text-zinc-200">{targetPreview}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveSelectedMessageToMemory}
            className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-[11px] text-zinc-200 transition hover:bg-white/10"
          >
            Save to Memory
          </button>
          <button
            type="button"
            onClick={saveSelectedMessageToKnowledge}
            className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-[11px] text-zinc-200 transition hover:bg-white/10"
          >
            Save to Knowledge
          </button>
        </div>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`rounded-lg px-2 py-1 text-sm ${
              turn.role === "USER"
                ? "ml-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/15 px-3 py-2 text-cyan-100"
                : "mr-5 rounded-2xl border border-zinc-700/80 bg-zinc-900/85 px-3 py-2 text-zinc-100"
            }`}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-400">{turn.role}</div>
            <div className="whitespace-pre-wrap">{turn.content}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {commandPrompts.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              void onChip(chip);
            }}
            className="rounded-full border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onSend();
            }
          }}
          placeholder="Ask about this message..."
          className="flex-1 rounded-xl border border-zinc-700/90 bg-zinc-900/90 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
        <button
          type="button"
          onClick={() => {
            void onSend();
          }}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:opacity-90"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => {
            void runContextAnswer();
          }}
          disabled={contextLoading || !prompt.trim()}
          className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-50"
        >
          {contextLoading ? "Loading..." : "Source-linked"}
        </button>
      </div>

      {knowledgeActions.notice ? (
        <div className="mt-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          {knowledgeActions.notice}
        </div>
      ) : null}
      {knowledgeActions.error ? (
        <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {knowledgeActions.error}
        </div>
      ) : null}

      {contextReply ? (
        <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/75">Context answer</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-100">{contextReply}</div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onCopy()}
          className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => {
            void onShare();
          }}
          disabled={!latestAi || busyAction !== null}
          className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Share to Chat
        </button>
        <button
          type="button"
          onClick={() => setForwardOpen((prev) => !prev)}
          disabled={!latestAi || busyAction !== null}
          className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Forward
        </button>
        <button
          type="button"
          onClick={saveLatestAnswerToMemory}
          disabled={!latestAi?.content}
          className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Save answer to Memory
        </button>
        <button
          type="button"
          onClick={saveLatestAnswerToKnowledge}
          disabled={!latestAi?.content}
          className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Save answer to Knowledge
        </button>
        <button
          type="button"
          onClick={() => {
            openInAiChatPage();
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10"
        >
          Open Full Page
        </button>
      </div>

      {(contextReply || contextLoading || contextError) && (
        <div className="mt-3">
          <AiResponseSources
            sources={contextSources}
            loading={contextLoading}
            error={contextError}
            emptyMessage="Run a source-linked answer to inspect which memory and conversation sources were used."
          />
        </div>
      )}

      {forwardOpen && (
        <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-900/85 p-3">
          <div className="mb-2 text-xs text-zinc-300">Forward AI answer to:</div>
          <select
            value={forwardTargetChatId}
            onChange={(event) => setForwardTargetChatId(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-cyan-500"
          >
            <option value="">Select chat</option>
            {forwardTargets.map((target) => (
              <option key={target.chatId} value={target.chatId}>
                {target.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void onForward();
            }}
            disabled={!forwardTargetChatId || busyAction !== null}
            className="mt-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1 text-xs font-medium text-zinc-950 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
