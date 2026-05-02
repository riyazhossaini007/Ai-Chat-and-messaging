import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MoreVertical, Pin } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { layoutTransition, optimizedMotionStyle } from "../../lib/motionVariants";

interface ChatItem {
  chatId: string;
  title: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isTyping?: boolean;
  typingText?: string;
  isOnline?: boolean;
  unreadCount?: number;
}

interface SidebarChatListProps {
  open: boolean;
  chats: ChatItem[];
  activeId?: string;
  getChatHref?: (chat: ChatItem) => string;
  onSelectChat?: (chat: ChatItem) => void;
  onShareChat?: (chat: ChatItem) => void;
  onPinChat?: (chat: ChatItem) => void;
  onArchiveChat?: (chat: ChatItem) => void;
  onUnarchiveChat?: (chat: ChatItem) => void;
  onDeleteChat?: (chat: ChatItem) => void;
}

export default function SidebarChatList({
  open,
  chats,
  activeId,
  getChatHref,
  onSelectChat,
  onShareChat,
  onPinChat,
  onArchiveChat,
  onUnarchiveChat,
  onDeleteChat,
}: SidebarChatListProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { chatId: routeChatId, groupId: routeGroupId } = useParams<{
    chatId?: string;
    groupId?: string;
  }>();
  const activeChatId = activeId ?? routeChatId ?? routeGroupId;
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const handleDocClick = () => setMenuOpenId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (!menuOpenId) return;
    const handleScroll = () => setMenuOpenId(null);
    const handleResize = () => setMenuOpenId(null);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [menuOpenId]);

  const formatTime = (value?: string) => {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openChat = (chat: ChatItem) => {
    if (onSelectChat) {
      onSelectChat(chat);
      return;
    }

    const resolvedChatId = chat.chatId || "";
    if (!resolvedChatId) return;

    const href = getChatHref ? getChatHref(chat) : `/chat/${encodeURIComponent(resolvedChatId)}`;
    localStorage.setItem("plaxeai_last_chat_path", href);
    navigate(href);

    window.setTimeout(() => {
      if (window.location.pathname === pathname) {
        window.location.assign(href);
      }
    }, 120);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible scrollbar-hide">
      <div className="flex flex-col gap-1 px-2">
        {chats.map((chat) => {
          const isActive = chat.chatId === activeChatId;

          return (
            <motion.div
              key={chat.chatId}
              layout
              transition={layoutTransition}
              role="button"
              tabIndex={0}
              onClick={() => openChat(chat)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openChat(chat);
                }
              }}
                className={`
                relative flex items-start gap-3 rounded-xl border
                transition-all duration-150
                ${open ? "px-3 py-2.5" : "p-2 justify-center"}
                ${
                  isActive
                    ? "border-cyan-400/45 bg-cyan-400/10 shadow-[0_10px_25px_-18px_rgba(34,211,238,0.9)]"
                    : "border-transparent hover:bg-zinc-900/90"
                }
              `}
              whileHover={{ y: -2 }}
              style={optimizedMotionStyle}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-primary-gradient" />
              )}
              <div className="relative mt-0.5 h-10 w-10 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center">
                {chat.avatar ? (
                  <img
                    src={chat.avatar}
                    alt=""
                    className={`w-full h-full rounded-full object-cover ${
                      isActive ? "ring-2 ring-cyan-300/40" : ""
                    }`}
                  />
                ) : (
                  <span className="text-sm font-medium uppercase">
                    {chat.title[0]}
                  </span>
                )}

                {!open && chat.unreadCount ? (
                  <motion.span
                    key={`collapsed-unread-${chat.chatId}-${chat.unreadCount}`}
                    className="absolute -top-1 -right-1 w-5 h-5 text-[10px]
                    bg-indigo-600 rounded-full flex items-center justify-center"
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                  >
                    {chat.unreadCount}
                  </motion.span>
                ) : null}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-zinc-900 ${
                    chat.isOnline ? "bg-emerald-500" : "bg-zinc-500"
                  }`}
                />
              </div>

              <div
                className={`
                  flex-1 min-w-0 overflow-hidden
                  transition-all duration-300
                  ${open ? "opacity-100 max-w-full" : "opacity-0 max-w-0"}
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`min-w-0 truncate text-sm font-medium leading-5 flex items-center gap-1.5 ${
                    isActive ? "text-cyan-100" : ""
                  }`}>
                    {chat.isPinned ? <Pin size={12} className="text-indigo-300" /> : null}
                    {chat.title}
                  </p>
                  {chat.lastMessageAt ? (
                    <span className={`shrink-0 text-[11px] leading-5 ${isActive ? "text-cyan-200/80" : "text-zinc-500"}`}>
                      {formatTime(chat.lastMessageAt)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2">
                  {chat.isTyping ? (
                    <p className="min-w-0 truncate text-xs italic text-emerald-400 animate-pulse">
                      {chat.typingText ?? "Typing..."}
                    </p>
                  ) : chat.lastMessage ? (
                    <p className="min-w-0 truncate text-xs leading-5 text-zinc-400">{chat.lastMessage}</p>
                  ) : (
                    <span className="min-w-0 truncate text-xs leading-5 text-zinc-500">No messages yet</span>
                  )}
                  {chat.unreadCount ? (
                    <motion.span
                      key={`expanded-unread-${chat.chatId}-${chat.unreadCount}`}
                      className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white"
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                    >
                      {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                    </motion.span>
                  ) : null}
                </div>
              </div>

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
                      setMenuOpenId((prev) =>
                        prev === chat.chatId ? null : chat.chatId
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
          );
        })}
      </div>
      {menuOpenId && menuPos
        ? createPortal(
            <div
              onClick={(event) => event.stopPropagation()}
              className="fixed z-[60] w-40 rounded-xl border border-border-subtle bg-bg-surface shadow-lg overflow-hidden"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              {(() => {
                const chat = chats.find((c) => c.chatId === menuOpenId);
                if (!chat) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        onShareChat?.(chat);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        onPinChat?.(chat);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
                    >
                      {chat.isPinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        if (chat.isArchived) {
                          onUnarchiveChat?.(chat);
                          return;
                        }
                        onArchiveChat?.(chat);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-elevated"
                    >
                      {chat.isArchived ? "Unarchive" : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        onDeleteChat?.(chat);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </>
                );
              })()}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

