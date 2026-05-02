import type { Account } from "./types";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { typingDotVariant } from "../../lib/motionVariants";
import { CallMenu } from "../../features/calls/CallMenu";

export default function ChatHeader({
  account,
  typingText,
  isOnline = false,
  chatId,
  peerUserId,
}: {
  account: Account;
  typingText?: string;
  isOnline?: boolean;
  chatId?: string;
  peerUserId?: string | null;
}) {
  const navigate = useNavigate();
  const hasAvatar = Boolean(account.avatar && account.avatar.trim().length > 0);
  const initial = (account.name || account.username || "U").trim().charAt(0).toUpperCase();
  const usernameLabel = account.username.startsWith("@") ? account.username : `@${account.username}`;

  return (
    <div className="relative z-[90] h-[68px] overflow-visible border-b border-cyan-500/20 bg-gradient-to-r from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 px-4 backdrop-blur">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white"
          aria-label="Go back"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="relative">
          {hasAvatar ? (
            <img
              src={account.avatar}
              alt={account.username}
              className="h-10 w-10 rounded-full border border-cyan-400/35 object-cover shadow-[0_0_24px_-10px_rgba(34,211,238,0.85)]"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/35 bg-gradient-to-br from-cyan-400/25 to-emerald-400/20 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_-10px_rgba(34,211,238,0.85)]">
              {initial}
            </div>
          )}

          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-900 ${
              isOnline ? "bg-emerald-400" : "bg-zinc-500"
            }`}
            title={isOnline ? "Online" : "Offline"}
            aria-label={isOnline ? "Online" : "Offline"}
          />
        </div>

        <div className="leading-tight">
          <p className="font-semibold tracking-tight text-white">{account.name}</p>
          <p className="text-sm text-zinc-300">
            {typingText ? (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <span>{typingText}</span>
                <span className="inline-flex items-end gap-0.5" aria-hidden="true">
                  {[0, 0.12, 0.24].map((delay, index) => (
                    <motion.span
                      key={`typing-dot-${index}`}
                      className="h-1 w-1 rounded-full bg-emerald-300"
                      variants={typingDotVariant}
                      animate="animate"
                      transition={{ duration: 0.36, ease: "easeInOut", repeat: Infinity, delay }}
                    />
                  ))}
                </span>
              </span>
            ) : (
              usernameLabel
            )}
          </p>
        </div>
        </div>
        <CallMenu chatId={chatId} peerUserId={peerUserId ?? undefined} isGroup={false} />
      </div>
    </div>
  );
}
