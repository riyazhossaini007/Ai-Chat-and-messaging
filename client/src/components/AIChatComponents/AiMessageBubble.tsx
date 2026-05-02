import type { AiMessage, AiModel } from "./AItypes";
import clsx from "clsx";
import { motion } from "motion/react";
import { layoutTransition, optimizedMotionStyle } from "../../lib/motionVariants";

interface Props {
  message: AiMessage;
  onSelectSuggestedModel?: (model: AiModel) => void;
  onRetryCurrentModel?: () => void;
}

export default function AiMessageBubble({
  message,
  onSelectSuggestedModel,
  onRetryCurrentModel,
}: Props) {
  const isUser = message.role === "user";
  const modelLabel = (() => {
    if (!message.modelUsed) return null;
    if (message.modelUsed === "openrouter") return "Euclit O1";
    if (message.modelUsed === "openai") return "OpenAI";
    if (message.modelUsed === "claude") return "Claude";
    if (message.modelUsed === "gemini") return "Gemini";
    return "Grok";
  })();
  const lines = message.content.split("\n");

  return (
    <motion.div
      data-message-bubble="true"
      layout
      transition={layoutTransition}
      style={optimizedMotionStyle}
      className={clsx(
        "w-fit min-w-[120px] max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] border shadow-sm",
        isUser
          ? "bg-gradient-to-br from-sky-500 to-cyan-500 text-white rounded-br-sm border-sky-300/20"
          : "bg-slate-900/85 text-zinc-100 rounded-bl-sm border-white/10"
      )}
    >
      {!isUser && modelLabel && (
        <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-cyan-200/80">
          [{modelLabel}]
        </div>
      )}
      {isUser ? (
        message.content
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.05 },
            },
          }}
        >
          {lines.map((line, index) => (
            <motion.div
              key={`ai-line-${message.id}-${index}`}
              variants={{
                hidden: { opacity: 0, y: 6 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.16, ease: "easeOut" } },
              }}
            >
              {line || "\u00a0"}
            </motion.div>
          ))}
        </motion.div>
      )}
      {message.kind === "degraded" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(message.suggestedModels ?? []).map((model) => (
            <button
              type="button"
              key={`suggested-${message.id}-${model}`}
              onClick={() => onSelectSuggestedModel?.(model)}
              className="rounded-lg border border-amber-300/35 bg-amber-300/15 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-300/25"
            >
              Switch to {model.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onRetryCurrentModel?.()}
            className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      )}
      {message.kind === "paywall" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/credits"
            className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-400/25"
          >
            Buy Credits
          </a>
        </div>
      )}
    </motion.div>
  );
}
