import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Download, Forward, Trash2, X } from "lucide-react";
import { fetchChatMedia } from "../api/media.api";
import { deleteMessages, forwardMessages } from "../api/message.api";
import { fetchChats } from "../api/chat.api";
import type { MediaMessageRecord } from "../api/types";
import { useAuthStore } from "../stores/authStore";
import { toChatListItem, useChatStore } from "../stores/chatStore";

type MediaCategory = "IMAGE" | "VIDEO" | "FILE";

type GroupedMedia = {
  dateLabel: string;
  images: MediaMessageRecord[];
  videos: MediaMessageRecord[];
  files: MediaMessageRecord[];
};

const toDateLabel = (isoDate: string) => {
  const date = new Date(isoDate);
  const now = new Date();

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(dayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const itemStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemStart.getTime() === dayStart.getTime()) return "Today";
  if (itemStart.getTime() === yesterdayStart.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const toCategoryTitle = (type: MediaCategory) => {
  if (type === "IMAGE") return "Images";
  if (type === "VIDEO") return "Videos";
  return "Files";
};

const formatFileSize = (raw?: string | null) => {
  if (!raw) return null;
  const match = raw.match(/\((\d+(?:\.\d+)?)\s*(B|KB|MB|GB)\)/i);
  return match?.[1] && match?.[2] ? `${match[1]} ${match[2].toUpperCase()}` : null;
};

const getFileKind = (name: string | null) => {
  if (!name) return "FILE";
  const ext = name.split(".").pop()?.toUpperCase();
  return ext || "FILE";
};

export default function ChatMediaPage() {
  const { chatId } = useParams<{ chatId?: string }>();

  const token = useAuthStore((store) => store.token);
  const authUser = useAuthStore((store) => store.user);
  const chats = useChatStore((store) => store.chats);
  const setChats = useChatStore((store) => store.setChats);

  const [media, setMedia] = useState<MediaMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const loadMedia = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const result = await fetchChatMedia(chatId, "chat");
      const filtered = result.filter(
        (item) => item.mediaUrl && (item.type === "IMAGE" || item.type === "VIDEO" || item.type === "FILE")
      );
      setMedia(filtered);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (!token || !chatId) return;
    void loadMedia();
  }, [chatId, loadMedia, token]);

  useEffect(() => {
    if (!token) return;
    if (chats.length > 0) return;
    void fetchChats().then((data) => setChats(data));
  }, [chats.length, setChats, token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (viewerIndex === null) return;
      if (event.key === "ArrowRight") {
        setViewerIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % media.length;
        });
      } else if (event.key === "ArrowLeft") {
        setViewerIndex((prev) => {
          if (prev === null) return prev;
          return (prev - 1 + media.length) % media.length;
        });
      } else if (event.key === "Escape") {
        setViewerIndex(null);
        setZoom(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [media.length, viewerIndex]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === chatId) ?? null,
    [chatId, chats]
  );

  const mappedChat = useMemo(
    () => (selectedChat ? toChatListItem(selectedChat, authUser?.id) : null),
    [authUser?.id, selectedChat]
  );

  const groupedMedia = useMemo<GroupedMedia[]>(() => {
    const byDate = new Map<string, GroupedMedia>();
    media.forEach((item) => {
      const label = toDateLabel(item.createdAt);
      if (!byDate.has(label)) {
        byDate.set(label, { dateLabel: label, images: [], videos: [], files: [] });
      }

      const target = byDate.get(label);
      if (!target) return;
      if (item.type === "IMAGE") target.images.push(item);
      else if (item.type === "VIDEO") target.videos.push(item);
      else target.files.push(item);
    });
    return Array.from(byDate.values());
  }, [media]);

  const selectedItems = useMemo(
    () => media.filter((item) => selectedMediaIds.has(item.id)),
    [media, selectedMediaIds]
  );

  const canDeleteForEveryone =
    selectedItems.length > 0 && selectedItems.every((item) => item.senderId === authUser?.id);

  const forwardTargets = useMemo(
    () =>
      chats
        .filter((chat) => chat.type !== "AI" && chat.id !== chatId)
        .map((chat) => toChatListItem(chat, authUser?.id)),
    [authUser?.id, chatId, chats]
  );

  const openSelectionModeWithItem = (messageId: string) => {
    setSelectionMode(true);
    setSelectedMediaIds(new Set([messageId]));
  };

  const toggleSelection = (messageId: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMediaIds(new Set());
    setForwardPickerOpen(false);
    setSelectedForwardChatIds(new Set());
    setDeleteDialogOpen(false);
  };

  const handleItemPointerDown = (messageId: string, pointerType: string) => {
    if (pointerType !== "touch") return;
    longPressTimer.current = window.setTimeout(() => {
      openSelectionModeWithItem(messageId);
    }, 450);
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const downloadOne = (item: MediaMessageRecord) => {
    if (!item.mediaUrl) return;
    const link = document.createElement("a");
    link.href = item.mediaUrl;
    link.download = item.content || `${item.type.toLowerCase()}-${item.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSelected = async () => {
    const items = media.filter((item) => selectedMediaIds.has(item.id));
    for (const item of items) {
      downloadOne(item);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
  };

  const confirmForward = async () => {
    if (selectedMediaIds.size === 0 || selectedForwardChatIds.size === 0) return;
    await forwardMessages({
      messageIds: Array.from(selectedMediaIds),
      targetChatIds: Array.from(selectedForwardChatIds),
    });
    const latestChats = await fetchChats();
    setChats(latestChats);
    cancelSelectionMode();
  };

  const confirmDelete = async (scope: "ME" | "EVERYONE") => {
    if (selectedMediaIds.size === 0) return;
    await deleteMessages({
      messageIds: Array.from(selectedMediaIds),
      scope,
    });
    cancelSelectionMode();
    await loadMedia();
  };

  const viewerItem = viewerIndex === null ? null : media[viewerIndex] ?? null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!chatId) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-400">Media Manager</div>
          <h1 className="text-xl font-semibold">{mappedChat?.title ?? "Chat"}</h1>
        </div>
        <Link
          to={`/chat/${chatId}`}
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm hover:border-zinc-500"
        >
          Back to chat
        </Link>
      </div>

      {selectionMode && (
        <div className="sticky top-0 z-20 border-y border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <div className="text-sm">{selectedMediaIds.size} selected</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setForwardPickerOpen(true)}
                disabled={selectedMediaIds.size === 0}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Forward
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={selectedMediaIds.size === 0}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  void downloadSelected();
                }}
                disabled={selectedMediaIds.size === 0}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Download
              </button>
              <button
                type="button"
                onClick={cancelSelectionMode}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 md:px-6">
        {loading ? (
          <div className="py-14 text-center text-sm text-zinc-400">Loading media...</div>
        ) : media.length === 0 ? (
          <div className="py-14 text-center text-sm text-zinc-400">No media in this chat yet.</div>
        ) : (
          <div className="space-y-8">
            {groupedMedia.map((group) => (
              <section key={group.dateLabel} className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  {group.dateLabel}
                </h2>
                {(["IMAGE", "VIDEO", "FILE"] as MediaCategory[]).map((type) => {
                  const list =
                    type === "IMAGE" ? group.images : type === "VIDEO" ? group.videos : group.files;
                  if (list.length === 0) return null;

                  return (
                    <div key={`${group.dateLabel}-${type}`} className="space-y-2">
                      <h3 className="text-sm text-zinc-300">{toCategoryTitle(type)}</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {list.map((item) => {
                          const checked = selectedMediaIds.has(item.id);
                          const timestamp = new Date(item.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <div
                              key={item.id}
                              className={`group relative overflow-hidden rounded-xl border ${
                                checked ? "border-sky-500 ring-2 ring-sky-500/40" : "border-zinc-800"
                              } bg-zinc-900/70`}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                if (!selectionMode) openSelectionModeWithItem(item.id);
                              }}
                              onPointerDown={(event) =>
                                handleItemPointerDown(item.id, event.pointerType)
                              }
                              onPointerUp={clearLongPress}
                              onPointerLeave={clearLongPress}
                            >
                              {selectionMode && (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSelection(item.id)}
                                  className="absolute left-2 top-2 z-10 h-4 w-4 accent-sky-500"
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  if (selectionMode) {
                                    toggleSelection(item.id);
                                    return;
                                  }
                                  const index = media.findIndex((mediaItem) => mediaItem.id === item.id);
                                  if (index >= 0) setViewerIndex(index);
                                }}
                                className="w-full text-left"
                              >
                                {item.type === "IMAGE" ? (
                                  <img
                                    src={item.mediaUrl ?? ""}
                                    alt={item.content ?? "Image"}
                                    className="h-36 w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : item.type === "VIDEO" ? (
                                  <video className="h-36 w-full object-cover" muted playsInline>
                                    <source src={item.mediaUrl ?? ""} />
                                  </video>
                                ) : (
                                  <div className="flex h-36 flex-col items-center justify-center gap-1 bg-zinc-900">
                                    <div className="text-2xl font-bold text-zinc-200">
                                      {getFileKind(item.content)}
                                    </div>
                                    <div className="px-3 text-center text-xs text-zinc-400">
                                      {item.content || "File"}
                                    </div>
                                    {formatFileSize(item.content) && (
                                      <div className="text-[11px] text-zinc-500">{formatFileSize(item.content)}</div>
                                    )}
                                  </div>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadOne(item)}
                                className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 opacity-0 transition group-hover:opacity-100"
                                aria-label="Download"
                                title="Download"
                              >
                                <Download size={14} />
                              </button>

                              <div className="space-y-1 px-2 py-2">
                                <div className="truncate text-xs text-zinc-200">
                                  {item.content || item.type.toLowerCase()}
                                </div>
                                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
                                  <span>{timestamp}</span>
                                  <span className="truncate rounded bg-zinc-800 px-1.5 py-0.5 normal-case">
                                    {item.sender.name}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </div>

      {viewerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <button
            type="button"
            onClick={() => {
              setViewerIndex(null);
              setZoom(1);
            }}
            className="absolute right-4 top-4 rounded-full bg-zinc-900/80 p-2"
          >
            <X size={16} />
          </button>

          <div className="absolute left-4 top-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadOne(viewerItem)}
              className="rounded-lg bg-zinc-900/80 px-3 py-2 text-xs"
            >
              <Download size={14} className="mr-1 inline" />
              Download
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectionMode(true);
                setSelectedMediaIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(viewerItem.id)) next.delete(viewerItem.id);
                  else next.add(viewerItem.id);
                  return next;
                });
              }}
              className="rounded-lg bg-zinc-900/80 px-3 py-2 text-xs"
            >
              Select
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectionMode(true);
                setSelectedMediaIds(new Set([viewerItem.id]));
                setForwardPickerOpen(true);
              }}
              className="rounded-lg bg-zinc-900/80 px-3 py-2 text-xs"
            >
              <Forward size={14} className="mr-1 inline" />
              Forward
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectionMode(true);
                setSelectedMediaIds(new Set([viewerItem.id]));
                setDeleteDialogOpen(true);
              }}
              className="rounded-lg bg-zinc-900/80 px-3 py-2 text-xs text-rose-300"
            >
              <Trash2 size={14} className="mr-1 inline" />
              Delete
            </button>
          </div>

          <div
            className="relative w-full max-w-5xl select-none"
            onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => {
              const endX = event.changedTouches[0]?.clientX ?? null;
              if (touchStartX === null || endX === null) return;
              const delta = endX - touchStartX;
              if (Math.abs(delta) < 40) return;
              if (delta < 0) {
                setViewerIndex((prev) => {
                  if (prev === null) return prev;
                  return (prev + 1) % media.length;
                });
              } else {
                setViewerIndex((prev) => {
                  if (prev === null) return prev;
                  return (prev - 1 + media.length) % media.length;
                });
              }
            }}
          >
            {viewerItem.type === "IMAGE" ? (
              <img
                src={viewerItem.mediaUrl ?? ""}
                alt={viewerItem.content ?? "Image"}
                className="max-h-[84vh] w-full object-contain"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                onWheel={(event) => {
                  event.preventDefault();
                  setZoom((prev) => {
                    const next = prev + (event.deltaY < 0 ? 0.12 : -0.12);
                    return Math.min(3, Math.max(1, Number(next.toFixed(2))));
                  });
                }}
              />
            ) : viewerItem.type === "VIDEO" ? (
              <video className="max-h-[84vh] w-full" controls autoPlay>
                <source src={viewerItem.mediaUrl ?? ""} />
              </video>
            ) : (
              <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
                <div className="text-4xl font-bold text-zinc-300">{getFileKind(viewerItem.content)}</div>
                <div className="text-sm text-zinc-200">{viewerItem.content || "File"}</div>
                <a
                  href={viewerItem.mediaUrl ?? ""}
                  download
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium"
                >
                  Download file
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setViewerIndex((prev) => {
                  if (prev === null) return prev;
                  return (prev - 1 + media.length) % media.length;
                });
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2"
            >
              {"<"}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewerIndex((prev) => {
                  if (prev === null) return prev;
                  return (prev + 1) % media.length;
                });
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2"
            >
              {">"}
            </button>
          </div>
        </div>
      )}

      {forwardPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Forward to chats</h3>
              <button
                type="button"
                onClick={() => setForwardPickerOpen(false)}
                className="rounded px-2 py-1 text-xs hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {forwardTargets.map((target) => {
                const checked = selectedForwardChatIds.has(target.chatId);
                return (
                  <button
                    key={target.chatId}
                    type="button"
                    onClick={() =>
                      setSelectedForwardChatIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(target.chatId)) next.delete(target.chatId);
                        else next.add(target.chatId);
                        return next;
                      })
                    }
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                      checked ? "border-sky-500 bg-sky-500/10" : "border-zinc-800 bg-zinc-900/60"
                    }`}
                  >
                    <div>
                      <div className="text-sm">{target.title}</div>
                      <div className="text-xs text-zinc-400">@{target.username}</div>
                    </div>
                    <input type="checkbox" readOnly checked={checked} className="h-4 w-4 accent-sky-500" />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={selectedForwardChatIds.size === 0}
              onClick={() => {
                void confirmForward();
              }}
              className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm disabled:opacity-50"
            >
              Forward
            </button>
          </div>
        </div>
      )}

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-base font-semibold">Delete media</div>
            <div className="mt-1 text-xs text-zinc-400">{selectedMediaIds.size} selected</div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  void confirmDelete("ME");
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-left text-sm"
              >
                Delete for me
              </button>
              {canDeleteForEveryone && (
                <button
                  type="button"
                  onClick={() => {
                    void confirmDelete("EVERYONE");
                  }}
                  className="w-full rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-left text-sm text-rose-200"
                >
                  Delete for everyone
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              className="mt-4 w-full rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
