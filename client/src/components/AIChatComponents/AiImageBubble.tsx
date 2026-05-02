import clsx from "clsx";
import type { AiMessage } from "./AItypes";
import { motion } from "motion/react";
import { layoutTransition, optimizedMotionStyle } from "../../lib/motionVariants";

interface Props {
  message: AiMessage;
}

export default function AiImageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <motion.div
      data-message-bubble="true"
      layout
      transition={layoutTransition}
      style={optimizedMotionStyle}
      className={clsx(
        "max-w-[340px] rounded-2xl overflow-hidden border shadow-sm",
        isUser ? "border-sky-400/40" : "border-white/15 bg-slate-900/70"
      )}
    >
      <motion.img
        src={message.content}
        alt="Generated"
        layoutId={`media-${message.id}`}
        className="w-full h-auto object-cover"
      />
    </motion.div>
  );
}
