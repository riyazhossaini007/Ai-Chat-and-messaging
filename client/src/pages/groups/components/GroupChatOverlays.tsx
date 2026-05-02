import type { Dispatch, SetStateAction } from "react";

type SeenByItem = { userId: string; username: string; avatar: string | null; readAt: string };

type ForwardTarget = {
  chatId: string;
  title: string;
  username: string;
  type: "DIRECT" | "GROUP" | "AI";
};

type GroupChatOverlaysProps = {
  seenByMessageId: string | null;
  seenByLoading: boolean;
  seenByItems: SeenByItem[];
  onCloseSeenBy: () => void;
  forwardPickerOpen: boolean;
  pendingForwardMessageIds: string[];
  forwardTargets: ForwardTarget[];
  selectedForwardChatIds: Record<string, true>;
  setSelectedForwardChatIds: Dispatch<SetStateAction<Record<string, true>>>;
  isForwarding: boolean;
  onCloseForwardPicker: () => void;
  onConfirmForwardTargets: () => void;
  shareTargetOpen: boolean;
  forwardTargetsDirect: ForwardTarget[];
  onCloseShare: () => void;
  onShareToChat: (chatId: string) => void;
  onShareToGroupPage: () => void;
  onShareToAi: () => void;
  onOutsideShare: () => void;
  deleteDialogOpen: boolean;
  isMultiSelect: boolean;
  selectedCount: number;
  canDeleteForEveryone: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onCancelSelection: () => void;
};

export default function GroupChatOverlays({
  seenByMessageId,
  seenByLoading,
  seenByItems,
  onCloseSeenBy,
  forwardPickerOpen,
  pendingForwardMessageIds,
  forwardTargets,
  selectedForwardChatIds,
  setSelectedForwardChatIds,
  isForwarding,
  onCloseForwardPicker,
  onConfirmForwardTargets,
  shareTargetOpen,
  forwardTargetsDirect,
  onCloseShare,
  onShareToChat,
  onShareToGroupPage,
  onShareToAi,
  onOutsideShare,
  deleteDialogOpen,
  isMultiSelect,
  selectedCount,
  canDeleteForEveryone,
  onDeleteForMe,
  onDeleteForEveryone,
  onCancelSelection,
}: GroupChatOverlaysProps) {
  return (
    <>
      {seenByMessageId && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <div className="h-full w-full max-w-sm border-l border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Seen by</h3>
              <button
                type="button"
                onClick={onCloseSeenBy}
                className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 overflow-y-auto">
              {seenByLoading && <div className="text-xs text-zinc-400">Loading...</div>}
              {!seenByLoading && seenByItems.length === 0 && (
                <div className="text-xs text-zinc-400">No reads yet.</div>
              )}
              {!seenByLoading &&
                seenByItems.map((item) => (
                  <div key={item.userId} className="flex items-center gap-3 rounded-lg bg-zinc-900/70 p-2">
                    <div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800">
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.username} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-primary-gradient" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-zinc-100">{item.username}</div>
                      <div className="text-[11px] text-zinc-400">{new Date(item.readAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {forwardPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Forward to chats/groups</h3>
              <button
                type="button"
                onClick={onCloseForwardPicker}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-1 text-xs text-zinc-400">{pendingForwardMessageIds.length} message(s) selected</div>
            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {forwardTargets.map((target) => {
                const checked = Boolean(selectedForwardChatIds[target.chatId]);
                return (
                  <button
                    key={`forward-target-${target.chatId}`}
                    type="button"
                    onClick={() =>
                      setSelectedForwardChatIds((prev) => {
                        const next = { ...prev };
                        if (next[target.chatId]) {
                          delete next[target.chatId];
                        } else {
                          next[target.chatId] = true;
                        }
                        return next;
                      })
                    }
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      checked
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-zinc-800 bg-zinc-900/60 hover:border-indigo-500/60"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{target.title}</div>
                      <div className="text-xs text-zinc-400">{target.type === "GROUP" ? "Group" : `@${target.username}`}</div>
                    </div>
                    <input type="checkbox" readOnly checked={checked} className="h-4 w-4 accent-sky-500" />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={Object.keys(selectedForwardChatIds).length === 0 || isForwarding}
              onClick={onConfirmForwardTargets}
              className="mt-4 w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isForwarding ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {shareTargetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share message to</h3>
              <button
                type="button"
                onClick={onCloseShare}
                className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Direct chats</div>
                <div className="space-y-2">
                  {forwardTargetsDirect.map((target) => (
                    <button
                      key={`share-direct-${target.chatId}`}
                      type="button"
                      onClick={() => onShareToChat(target.chatId)}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                    >
                      <div>
                        <div className="text-sm font-medium">{target.title}</div>
                        <div className="text-xs text-zinc-400">@{target.username}</div>
                      </div>
                      <span className="text-xs text-indigo-300">Share</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Groups</div>
                <button
                  type="button"
                  onClick={onShareToGroupPage}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">Group page</div>
                    <div className="text-xs text-zinc-400">Choose group on Groups page</div>
                  </div>
                  <span className="text-xs text-indigo-300">Open</span>
                </button>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">AI</div>
                <button
                  type="button"
                  onClick={onShareToAi}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">New AI chat</div>
                    <div className="text-xs text-zinc-400">Open with shared message</div>
                  </div>
                  <span className="text-xs text-indigo-300">Open</span>
                </button>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Outside share</div>
                <button
                  type="button"
                  onClick={onOutsideShare}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-indigo-500/60"
                >
                  <div>
                    <div className="text-sm font-medium">System share</div>
                    <div className="text-xs text-zinc-400">Share via other apps</div>
                  </div>
                  <span className="text-xs text-indigo-300">Open</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteDialogOpen && isMultiSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-white shadow-xl">
            <div className="text-base font-semibold">Delete messages</div>
            <div className="mt-1 text-xs text-zinc-400">{selectedCount} selected</div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={onDeleteForMe}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-left text-sm hover:border-zinc-500"
              >
                Delete for me
              </button>
              {canDeleteForEveryone && (
                <button
                  type="button"
                  onClick={onDeleteForEveryone}
                  className="w-full rounded-xl border border-rose-700 bg-rose-950/40 px-3 py-2 text-left text-sm text-rose-200 hover:border-rose-500"
                >
                  Delete for everyone
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onCancelSelection}
              className="mt-4 w-full rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
