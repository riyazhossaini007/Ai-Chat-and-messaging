import { motion } from "motion/react";

type GroupSendState = "SENDING" | "SENT" | "DELIVERED" | "READ";

type GroupSendDotsProps = {
  state: GroupSendState;
  readCount: number;
  onOpenSeenBy?: () => void;
};

const buildAriaLabel = (state: GroupSendState, readCount: number) => {
  if (state === "SENDING") return "Message sending";
  if (state === "SENT") return "Message sent";
  if (state === "DELIVERED") return "Message delivered";
  return `Message read by ${readCount}`;
};

const dotClass = (opts: {
  isOn: boolean;
  isRead: boolean;
}) => {
  const base = "inline-block h-1.5 w-1.5 rounded-full";
  const color = opts.isRead
    ? "bg-emerald-300"
    : opts.isOn
    ? "bg-white"
    : "bg-white/30";
  return `${base} ${color}`.trim();
};

export default function GroupSendDots({
  state,
  readCount,
  onOpenSeenBy,
}: GroupSendDotsProps) {
  const isRead = state === "READ";
  const solidDots =
    state === "SENT" ? 1 : state === "DELIVERED" ? 2 : state === "READ" ? 3 : 0;
  const isSending = state === "SENDING";
  const dotDelay = [0, 0.12, 0.24];

  return (
    <div className="flex items-center gap-2" aria-label={buildAriaLabel(state, readCount)}>
      <div className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={`group-send-dot-${index}`}
            className={dotClass({ isOn: solidDots > index, isRead })}
            animate={
              isSending
                ? { opacity: [0.35, 1, 0.35] }
                : { opacity: 1 }
            }
            transition={
              isSending
                ? { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: dotDelay[index] }
                : undefined
            }
          />
        ))}
      </div>
      {state === "READ" && readCount > 0 && (
        <button
          type="button"
          onClick={onOpenSeenBy}
          className="text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
        >
           {readCount}
        </button>
      )}
    </div>
  );
}
