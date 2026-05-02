import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fetchMessageReactions } from "../../api/message.api";
import type { MessageReactionDetailsRecord } from "../../api/types";
import { fadeScaleVariant, reactionPopVariant } from "../../lib/motionVariants";

type ReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

type MessageReactionStripProps = {
  messageId: string;
  summary: ReactionSummary[];
  onToggleReaction?: (messageId: string, emoji: string) => void;
};

export default function MessageReactionStrip({
  messageId,
  summary,
  onToggleReaction,
}: MessageReactionStripProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<MessageReactionDetailsRecord[]>([]);

  const visibleSummary = useMemo(
    () => summary.filter((item) => item.count > 0),
    [summary]
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchMessageReactions(messageId)
      .then((data) => {
        setDetails(data.reactions);
      })
      .finally(() => setLoading(false));
  }, [messageId, open]);

  if (visibleSummary.length === 0) return null;

  return (
    <div className="mt-1 flex justify-start">
      <div className="relative">
        <motion.button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-wrap items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2 py-1 text-[11px]"
        >
          <AnimatePresence initial={false}>
            {visibleSummary.map((item) => (
              <motion.span
              key={item.emoji}
              variants={reactionPopVariant}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${
                item.reactedByMe
                  ? "bg-sky-500/20 text-sky-200"
                  : "bg-black/20 text-zinc-200"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleReaction?.(messageId, item.emoji);
              }}
              >
                <span>{item.emoji}</span>
                <span>{item.count}</span>
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              variants={fadeScaleVariant}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute left-0 z-30 mt-1 w-64 max-w-[70vw] rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 text-xs text-zinc-200 shadow-xl"
            >
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-400">
                Reactions
              </div>
              {loading && <div className="text-zinc-400">Loading...</div>}
              {!loading && details.length === 0 && (
                <div className="text-zinc-400">No reactions</div>
              )}
              {!loading &&
                details.map((item) => (
                  <div key={item.emoji} className="mb-2">
                    <div className="font-medium">
                      {item.emoji} {item.count}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-zinc-400">
                      {item.users.map((user) => user.username).join(", ")}
                    </div>
                  </div>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
