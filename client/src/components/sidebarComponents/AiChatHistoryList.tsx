import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { layoutTransition, optimizedMotionStyle } from "../../lib/motionVariants";

export interface AiChatHistoryItem {
  id: string;
  title: string;
  updatedAt?: string;
  pinned?: boolean;
}

interface AiChatHistoryListProps {
  open: boolean;
  chats: AiChatHistoryItem[];
  onRenameChat?: (chat: AiChatHistoryItem) => void;
  onShareInAppChat?: (chat: AiChatHistoryItem) => void;
  onShareOutsideChat?: (chat: AiChatHistoryItem) => void;
  onPinChat?: (chat: AiChatHistoryItem) => void;
  onDeleteChat?: (chat: AiChatHistoryItem) => void;
  selectedChatId?: string | null;
}

export default function AiChatHistoryList({
  open,
  chats,
  onRenameChat,
  onShareInAppChat,
  onShareOutsideChat,
  onPinChat,
  onDeleteChat,
  selectedChatId = null,
}: AiChatHistoryListProps) {
  const navigate = useNavigate();
  const [menuChat, setMenuChat] = useState<AiChatHistoryItem | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuChat) return;
    const handleDocClick = () => setMenuChat(null);
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [menuChat]);

  useEffect(() => {
    if (!menuChat) return;
    const handleScroll = () => setMenuChat(null);
    const handleResize = () => setMenuChat(null);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [menuChat]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible scrollbar-thin scrollbar-thumb-zinc-700">
      {chats.length === 0 && open && (
        <p className="text-xs text-zinc-500 px-4 mt-4">
          No AI chats yet
        </p>
      )}

      <ul className="mt-2 space-y-1">
        {chats.map((chat) => {
          const isActive = selectedChatId === chat.id;
          return (
            <motion.li key={chat.id} layout transition={layoutTransition}>
              <motion.div
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/ai/${chat.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/ai/${chat.id}`);
                  }
                }}
                className={`mx-2 w-auto flex items-center gap-2 px-3 py-2 rounded-lg transition
                ${isActive ? "bg-cyan-500/15 border border-cyan-400/35" : "hover:bg-zinc-800 border border-transparent"}
                ${open ? "justify-start" : "justify-center"}`}
                whileHover={{ y: -2 }}
                style={optimizedMotionStyle}
              >
                {open && (
                  <span className={`text-sm truncate flex-1 ${isActive ? "text-cyan-200" : ""}`}>
                    {chat.title || "New AI Chat"}
                  </span>
                )}

                {open && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const menuWidth = 160;
                        const left = Math.max(8, rect.right - menuWidth);
                        const top = rect.bottom + 8;
                        setMenuPos({ top, left });
                        setMenuChat((prev) =>
                          prev?.id === chat.id ? null : chat
                        );
                      }}
                      className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                      aria-label="Chat options"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.li>
          );
        })}
      </ul>
      {menuChat && menuPos
        ? createPortal(
            <div
              onClick={(event) => event.stopPropagation()}
              className="fixed z-[60] w-40 rounded-xl border border-border-subtle bg-bg-surface shadow-lg overflow-hidden"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuChat(null);
                  onRenameChat?.(menuChat);
                }}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuChat(null);
                  onShareInAppChat?.(menuChat);
                }}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
              >
                Share In App
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuChat(null);
                  onShareOutsideChat?.(menuChat);
                }}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
              >
                Share Outside
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuChat(null);
                  onPinChat?.(menuChat);
                }}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
              >
                {menuChat.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuChat(null);
                  onDeleteChat?.(menuChat);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
