import SidebarChatList from "./SidebarChatList";
import GroupList from "./GroupList";
import type { GroupActionId } from "./GroupList";
import { useNavigate } from "react-router-dom";
import SidebarMediaList from "./SidebarMediaList";
import SidebarSearch from "./SidebarSearch";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { SidebarSection } from "./ThinSidebar";
import CreditsInfo from "./CreditsInfo";
import MediaScopeSelector from "./MediaScopeSelector";
import type { MediaScope } from "./media";
import type { NearbyUserRecord } from "../../api/types";
import { useChatStore } from "../../stores/chatStore";
import { optimizedMotionStyle } from "../../lib/motionVariants";

type MainSidebarProps = {
  activeSection: SidebarSection;
  chats: any[];
  nearbyUsers?: NearbyUserRecord[];
  users: any[];
  media: any[];
  groups?: import("./GroupList").GroupItem[];
  onNewGroup?: () => void;
  credits?: number;
  onBuyCredits?: () => void;
  onSearch?: (value: string) => void;
  onPinChat?: (chatId: string) => void;
  onArchiveChat?: (chatId: string) => void;
  onUnarchiveChat?: (chatId: string) => void;
  onShareChat?: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  mediaScope?: MediaScope;
  onMediaScopeChange?: (scope: MediaScope) => void;
  canSelectThisChat?: boolean;
  onSelectNearbyUser?: (user: NearbyUserRecord) => void;
  onOpenMediaManager?: () => void;
};

const sectionTitle: Record<SidebarSection, string> = {
  chats: "Chats",
  groups: "Groups",
  media: "Media",
  users: "Users",
  settings: "Settings",
};

export default function MainSidebar({
  activeSection,
  chats,
  nearbyUsers = [],
  media,
  groups = [],
  onNewGroup,
  credits,
  onBuyCredits,
  onSearch,
  onPinChat,
  onArchiveChat,
  onUnarchiveChat,
  onShareChat,
  onDeleteChat,
  mediaScope = "chat",
  onMediaScopeChange,
  canSelectThisChat = true,
  onSelectNearbyUser,
  onOpenMediaManager,
}: MainSidebarProps) {
  const navigate = useNavigate();
  const typingUsersByChatId = useChatStore((state) => state.typingUsersByChatId);
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    onSearch?.(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const chatsWithTyping = useMemo(
    () =>
      chats.map((chat) => {
        const typingIds = typingUsersByChatId[chat.chatId] ?? [];
        const typingNames = typingIds
          .map((userId) =>
            userId === chat.peerUserId ? chat.title : chat.type === "GROUP" ? userId : null
          )
          .filter(Boolean) as string[];
        const typingText =
          typingNames.length === 0
            ? undefined
            : typingNames.length === 1
            ? `${typingNames[0]} is typing...`
            : `${typingNames.slice(0, 2).join(", ")} typing...`;

        return {
          ...chat,
          typingText,
          isTyping: typingNames.length > 0,
          isOnline: chat.peerUserId ? onlineUsers.has(chat.peerUserId) : false,
        };
      }),
    [chats, onlineUsers, typingUsersByChatId]
  );

  const filteredChats = useMemo(() => {
    if (!debouncedQuery) return chatsWithTyping;
    return chatsWithTyping.filter((chat) => {
      const title = chat.title.toLowerCase();
      const username = chat.username.toLowerCase();
      const preview = (chat.rawLastMessage ?? chat.lastMessage ?? "").toLowerCase();
      return (
        title.includes(debouncedQuery) ||
        username.includes(debouncedQuery) ||
        preview.includes(debouncedQuery)
      );
    });
  }, [chatsWithTyping, debouncedQuery]);

  const pinnedChats = filteredChats.filter((chat) => !chat.isArchived && chat.isPinned);
  const mainChats = filteredChats.filter((chat) => !chat.isArchived && !chat.isPinned);
  const archivedChats = filteredChats.filter((chat) => chat.isArchived);
  const isSearching = debouncedQuery.length > 0;

  const hasChats = chats.length > 0;
  const shouldShowNearby = !hasChats || nearbyUsers.length > 0;

  const renderNearbyUsers = () => {
    if (nearbyUsers.length === 0) {
      return (
        <div className="p-4 text-sm text-text-muted">
          No nearby users available yet.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 px-2">
        {nearbyUsers.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelectNearbyUser?.(user)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-900"
          >
            <div className="relative w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium uppercase">{user.name[0] ?? "U"}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{user.name}</p>
              <p className="text-xs text-zinc-400 truncate">@{user.username}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" } }}
      style={optimizedMotionStyle}
      className="flex h-screen w-[280px] min-w-[280px] flex-col overflow-y-auto border-r border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 text-text-primary backdrop-blur-xl max-sm:w-[220px] max-sm:min-w-[220px]"
    >
      <div className="sticky top-0 z-10 bg-zinc-950/85 shadow-[0_10px_30px_-25px_rgba(6,182,212,0.8)] backdrop-blur-xl">
        <div className="border-b border-cyan-400/20 px-4 py-4">
          <h1 className="text-lg font-bold tracking-wide text-text-primary">
            Euclit
          </h1>
        </div>
        <div className="px-3 py-2">
          <SidebarSearch
            open
            onOpenSidebar={() => { }}
            onSearch={setQuery}
          />
        </div>
        <div className="flex items-center justify-between px-3 pb-1">
          <h1 className="text-sm font-semibold tracking-wide text-text-primary">
            {sectionTitle[activeSection]}
          </h1>
        </div>
        {activeSection === "media" && (
          <MediaScopeSelector
            value={mediaScope}
            onChange={(scope) => onMediaScopeChange?.(scope)}
            canSelectThisChat={canSelectThisChat}
            onViewAllMedia={canSelectThisChat ? onOpenMediaManager : undefined}
          />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {activeSection === "chats" && (
          <div className="space-y-3 py-2">
            {isSearching ? (
              <div>
                <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Search Results
                </h2>
                {filteredChats.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-text-muted">
                    No chats found for "{query.trim()}".
                  </div>
                ) : (
                  <SidebarChatList
                    open={true}
                    chats={filteredChats}
                    onShareChat={(chat) => onShareChat?.(chat.chatId)}
                    onPinChat={(chat) => onPinChat?.(chat.chatId)}
                    onArchiveChat={(chat) => onArchiveChat?.(chat.chatId)}
                    onUnarchiveChat={(chat) => onUnarchiveChat?.(chat.chatId)}
                    onDeleteChat={(chat) => onDeleteChat?.(chat.chatId)}
                  />
                )}
              </div>
            ) : (
              <>
                {pinnedChats.length > 0 && (
                  <div>
                    <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Pinned
                    </h2>
                    <SidebarChatList
                      open={true}
                      chats={pinnedChats}
                      onShareChat={(chat) => onShareChat?.(chat.chatId)}
                      onPinChat={(chat) => onPinChat?.(chat.chatId)}
                      onArchiveChat={(chat) => onArchiveChat?.(chat.chatId)}
                      onUnarchiveChat={(chat) => onUnarchiveChat?.(chat.chatId)}
                      onDeleteChat={(chat) => onDeleteChat?.(chat.chatId)}
                    />
                  </div>
                )}
                {mainChats.length > 0 && (
                  <div>
                    <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Chats
                    </h2>
                    <SidebarChatList
                      open={true}
                      chats={mainChats}
                      onShareChat={(chat) => onShareChat?.(chat.chatId)}
                      onPinChat={(chat) => onPinChat?.(chat.chatId)}
                      onArchiveChat={(chat) => onArchiveChat?.(chat.chatId)}
                      onUnarchiveChat={(chat) => onUnarchiveChat?.(chat.chatId)}
                      onDeleteChat={(chat) => onDeleteChat?.(chat.chatId)}
                    />
                  </div>
                )}
                {archivedChats.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setArchivedOpen((prev) => !prev)}
                      className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-white"
                    >
                      Archived ({archivedChats.length})
                    </button>
                    {archivedOpen && (
                      <SidebarChatList
                        open={true}
                        chats={archivedChats}
                        onShareChat={(chat) => onShareChat?.(chat.chatId)}
                        onPinChat={(chat) => onPinChat?.(chat.chatId)}
                        onArchiveChat={(chat) => onArchiveChat?.(chat.chatId)}
                        onUnarchiveChat={(chat) => onUnarchiveChat?.(chat.chatId)}
                        onDeleteChat={(chat) => onDeleteChat?.(chat.chatId)}
                      />
                    )}
                  </div>
                )}
              </>
            )}
            {!isSearching && shouldShowNearby && (
              <div>
                <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  People Nearby
                </h2>
                {renderNearbyUsers()}
              </div>
            )}
          </div>
        )}
        {activeSection === "groups" && (
          <div>
            {onNewGroup && (
              <div className="px-2 py-3">
                <button
                  type="button"
                  onClick={onNewGroup}
                  className="w-full rounded-xl border border-border-subtle bg-primary-gradient px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated/80"
                >
                  Create New Group
                </button>
              </div>
            )}
            <div>
              <GroupList
                groups={groups}
                onSelectGroup={(group) => {
                  if (!group.groupId) return;
                  navigate(`/groups/${group.groupId}`);
                }}
                onAction={(action: GroupActionId, group) => {
                  console.log("group action", action, group.groupId);
                }}
              />
            </div>
          </div>
        )}
        {activeSection === "media" && (
          <SidebarMediaList media={media} />
        )}
        {activeSection === "users" && (
          renderNearbyUsers()
        )}
        {activeSection === "settings" && (
          <div className="p-4 text-sm text-text-muted">
            Settings panel coming soon.
          </div>
        )}
      </div>

      {typeof credits === "number" && onBuyCredits && (
        <div className="sticky bottom-0 z-10 items-center border-t border-cyan-400/20 bg-zinc-950/90 shadow-[0_-10px_30px_-25px_rgba(6,182,212,0.7)] backdrop-blur-xl">
          <CreditsInfo open credits={credits} onBuyCredits={onBuyCredits} />
        </div>
      )}
    </motion.aside>
  );
}
