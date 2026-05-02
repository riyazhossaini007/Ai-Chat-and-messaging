import { motion } from "motion/react";
import { statusPulseTransition } from "../../lib/motionVariants";

type Status = "sent" | "delivered" | "read";

export function MessageStatusDots({ status }: { status?: Status }) {
  const isSending = !status;
  const isRead = status === "read";
  return (
    <div className="flex items-center gap-1">
      <Dot active animate={isSending} isRead={isRead} />
      <Dot
        active={status === "delivered" || status === "read"}
        animate={isSending || status === "sent"}
        isRead={isRead}
      />
      <Dot
        active={status === "read"}
        animate={isSending || status === "sent" || status === "delivered"}
        isRead={isRead}
      />
    </div>
  );
}

function Dot({
  active = false,
  animate = false,
  isRead = false,
}: {
  active?: boolean;
  animate?: boolean;
  isRead?: boolean;
}) {
  return (
    <motion.span
      className={`
        w-1.5 h-1.5 rounded-full
        ${active ? (isRead ? "bg-emerald-300" : "bg-white") : "bg-white/35"}
      `}
      animate={animate ? { scale: [1, 1.25, 1] } : undefined}
      transition={animate ? statusPulseTransition : undefined}
    />
  );
}
