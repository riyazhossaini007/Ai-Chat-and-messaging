import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { forwardAiTurn, getAiThread, shareAiTurnToChat, type AiThreadTargetMessage } from "../api/ai.api";
import { useAiThreadStore } from "../stores/aiThreadStore";
import { useAuthStore } from "../stores/authStore";
import { toChatListItem, useChatStore } from "../stores/chatStore";

export default function AiThreadPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const chats = useChatStore((state) => state.chats);
  const loadThread = useAiThreadStore((state) => state.loadThread);
  const sendTurn = useAiThreadStore((state) => state.sendTurn);
  const setActiveThread = useAiThreadStore((state) => state.setActiveThread);
  const turnsByThreadId = useAiThreadStore((state) => state.turnsByThreadId);
  const threadsById = useAiThreadStore((state) => state.threadsById);

  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<AiThreadTargetMessage>(null);
  const [forwardChatId, setForwardChatId] = useState("");
  const [busy, setBusy] = useState<"share" | "forward" | null>(null);

  useEffect(() => {
    if (!threadId) return;
    setActiveThread(threadId);
    void loadThread(threadId);
    void getAiThread(threadId).then((payload) => {
      setTarget(payload.targetMessage);
    });
  }, [loadThread, setActiveThread, threadId]);

  if (!threadId) return <Navigate to="/404" replace />;

  const thread = threadsById[threadId];
  const turns = turnsByThreadId[threadId] ?? [];
  const latestAi = [...turns].reverse().find((turn) => turn.role === "AI");
  const forwardTargets = useMemo(
    () =>
      chats
        .filter((chat) => chat.type !== "AI" && chat.id !== thread?.chatId)
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chats, thread?.chatId]
  );

  const onSend = async () => {
    const value = prompt.trim();
    if (!value) return;
    setPrompt("");
    await sendTurn(value);
  };

  const onShare = async () => {
    if (!latestAi || !threadId) return;
    setBusy("share");
    try {
      await shareAiTurnToChat(threadId, latestAi.id);
    } finally {
      setBusy(null);
    }
  };

  const onForward = async () => {
    if (!latestAi || !threadId || !forwardChatId) return;
    setBusy("forward");
    try {
      await forwardAiTurn(threadId, { aiTurnId: latestAi.id, toChatId: forwardChatId });
      setForwardChatId("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-gradient-to-b from-zinc-950 via-zinc-950 to-[#03161d] text-zinc-100">
      <div className="border-b border-cyan-300/20 bg-zinc-950/80 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 rounded-lg border border-zinc-700/80 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-white/10"
        >
          Back
        </button>
        <div className="text-lg font-semibold text-cyan-100">AI Thread</div>
        <div className="mt-2 max-w-3xl rounded-2xl border border-cyan-300/20 bg-cyan-500/5 px-3 py-2 text-xs text-zinc-300">
          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300/70">Selected message</div>
          <div>{target?.unavailable ? "Target message not available" : target?.content ?? "No target preview"}</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`max-w-3xl rounded-xl px-3 py-2 ${
              turn.role === "USER"
                ? "ml-auto rounded-2xl border border-cyan-300/20 bg-cyan-500/15 text-cyan-100"
                : "rounded-2xl border border-zinc-700/80 bg-zinc-900/85"
            }`}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">{turn.role}</div>
            <div className="whitespace-pre-wrap">{turn.content}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-cyan-300/20 bg-zinc-950/80 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!latestAi?.content) return;
              void navigator.clipboard?.writeText(latestAi.content);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs transition hover:bg-white/10"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => {
              void onShare();
            }}
            disabled={!latestAi || busy !== null}
            className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs transition hover:bg-white/10 disabled:opacity-50"
          >
            Share to Chat
          </button>
          <select
            value={forwardChatId}
            onChange={(event) => setForwardChatId(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs outline-none focus:border-cyan-500"
          >
            <option value="">Forward to...</option>
            {forwardTargets.map((targetItem) => (
              <option key={targetItem.chatId} value={targetItem.chatId}>
                {targetItem.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void onForward();
            }}
            disabled={!latestAi || !forwardChatId || busy !== null}
            className="rounded-lg border border-zinc-700 bg-zinc-900/75 px-2 py-1 text-xs transition hover:bg-white/10 disabled:opacity-50"
          >
            Forward
          </button>
        </div>

        <div className="flex gap-2">
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
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
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
        </div>
      </div>
    </div>
  );
}
