import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Shield, Crown, UserMinus, X, Link, Copy } from "lucide-react";
import type { GroupDetailsRecord, GroupInsightRecord, KnowledgeItemRecord } from "../../api/types";
import GroupIntelligencePanel from "./GroupIntelligencePanel";

type Props = {
  open: boolean;
  group: GroupDetailsRecord | null;
  onClose: () => void;
  onSaveDescription?: (value: string) => void;
  onSaveRules?: (value: string) => void;
  onRemoveMember?: (userId: string) => void;
  onPromote?: (userId: string) => void;
  onDemote?: (userId: string) => void;
  onCreateInvite?: () => void;
  onRevokeInvite?: () => void;
  onSaveAvatar?: (avatar: string) => void;
  onRemoveAvatar?: () => void;
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
  addMemberCandidates?: Array<{
    userId: string;
    name: string;
    username: string;
    avatar?: string | null;
  }>;
  onAddMembers?: (userIds: string[]) => void;
  intelligence?: {
    loading: boolean;
    error?: string | null;
    insights: GroupInsightRecord[];
    decisions: KnowledgeItemRecord[];
    tasks: KnowledgeItemRecord[];
  };
};

export default function GroupInfoPanel({
  open,
  group,
  onClose,
  onSaveDescription,
  onSaveRules,
  onRemoveMember,
  onPromote,
  onDemote,
  onCreateInvite,
  onRevokeInvite,
  onSaveAvatar,
  onRemoveAvatar,
  onLeaveGroup,
  onDeleteGroup,
  addMemberCandidates = [],
  onAddMembers,
  intelligence,
}: Props) {
  const [descriptionDraft, setDescriptionDraft] = useState(group?.description ?? "");
  const [rulesDraft, setRulesDraft] = useState(group?.rulesText ?? "");
  const [avatarDraft, setAvatarDraft] = useState(group?.avatar ?? null);
  const [selectedNewMembers, setSelectedNewMembers] = useState<Record<string, true>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canManage = group?.myRole === "ADMIN" || group?.myRole === "CREATOR";
  const isCreator = group?.myRole === "CREATOR";

  const inviteUrl = useMemo(() => {
    if (!group?.invite?.token) return null;
    return `${window.location.origin}/groups/join/${group.invite.token}`;
  }, [group?.invite?.token]);

  useEffect(() => {
    setDescriptionDraft(group?.description ?? "");
    setRulesDraft(group?.rulesText ?? "");
    setAvatarDraft(group?.avatar ?? null);
    setSelectedNewMembers({});
  }, [group?.avatar, group?.description, group?.id, group?.rulesText]);

  const onAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (!dataUrl) return;
      setAvatarDraft(dataUrl);
      onSaveAvatar?.(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  if (!open || !group) return null;

  return (
    <div className="fixed inset-0 z-[140] flex justify-end bg-black/60 backdrop-blur-[2px]">
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,#090b14_0%,#080b12_100%)] text-zinc-100">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">Group Info</h2>
              <p className="text-xs text-zinc-400">Manage members, roles, and settings</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-zinc-900/90 to-emerald-500/10 p-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-zinc-800">
                {avatarDraft ? (
                  <img src={avatarDraft} alt={group.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-200">
                    {(group.title || "G").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-white">{group.title}</div>
                <div className="mt-1 text-xs text-zinc-300">{group.memberCount} members</div>
                <div className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                  {group.myRole}
                </div>
              </div>
            </div>
            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-xs transition hover:border-zinc-500"
                >
                  Change photo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarDraft(null);
                    onRemoveAvatar?.();
                  }}
                  className="rounded-lg border border-rose-700/80 bg-rose-950/20 px-3 py-1.5 text-xs text-rose-300 transition hover:border-rose-500"
                >
                  Remove photo
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarFileChange}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/45 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Manage</div>

            <div className="mt-4 text-xs uppercase tracking-wide text-zinc-500">Description</div>
            <textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              disabled={!canManage}
              className="mt-2 h-24 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm focus:border-cyan-500/50 focus:outline-none disabled:opacity-70"
            />
            {canManage && (
              <button
                type="button"
                onClick={() => onSaveDescription?.(descriptionDraft)}
                className="mt-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs text-white transition hover:bg-cyan-500"
              >
                Save description
              </button>
            )}

            <div className="mt-5 text-xs uppercase tracking-wide text-zinc-500">Rules / pinned note</div>
            <textarea
              value={rulesDraft}
              onChange={(event) => setRulesDraft(event.target.value)}
              disabled={!canManage}
              className="mt-2 h-24 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm focus:border-cyan-500/50 focus:outline-none disabled:opacity-70"
            />
            {canManage && (
              <button
                type="button"
                onClick={() => onSaveRules?.(rulesDraft)}
                className="mt-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs text-white transition hover:bg-cyan-500"
              >
                Save rules
              </button>
            )}

            <div className="mt-5 text-xs uppercase tracking-wide text-zinc-500">Invite link</div>
            <div className="mt-2 break-all rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
              {inviteUrl ?? "No active invite"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={onCreateInvite}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/75 px-3 py-1.5 text-xs transition hover:border-zinc-500"
                >
                  <Link size={12} />
                  Generate
                </button>
              )}
              {inviteUrl && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(inviteUrl)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/75 px-3 py-1.5 text-xs transition hover:border-zinc-500"
                >
                  <Copy size={12} />
                  Copy
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={onRevokeInvite}
                  className="rounded-lg border border-rose-700/80 bg-rose-950/20 px-3 py-1.5 text-xs text-rose-300 transition hover:border-rose-500"
                >
                  Revoke
                </button>
              )}
            </div>

            {canManage && (
              <>
                <div className="mt-5 text-xs uppercase tracking-wide text-zinc-500">Add members</div>
                <div className="mt-2 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-2">
                  {addMemberCandidates.length === 0 ? (
                    <div className="px-1 py-2 text-xs text-zinc-500">No contacts available to add</div>
                  ) : (
                    <>
                      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                        {addMemberCandidates.map((candidate) => {
                          const checked = Boolean(selectedNewMembers[candidate.userId]);
                          return (
                            <button
                              key={candidate.userId}
                              type="button"
                              onClick={() =>
                                setSelectedNewMembers((prev) => {
                                  const next = { ...prev };
                                  if (next[candidate.userId]) {
                                    delete next[candidate.userId];
                                  } else {
                                    next[candidate.userId] = true;
                                  }
                                  return next;
                                })
                              }
                              className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                                checked
                                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-100"
                                  : "border-zinc-800 text-zinc-200 hover:border-zinc-700"
                              }`}
                            >
                              <div className="truncate">
                                {candidate.name} <span className="text-zinc-500">@{candidate.username}</span>
                              </div>
                              <input
                                type="checkbox"
                                readOnly
                                checked={checked}
                                className="h-3.5 w-3.5 accent-cyan-500"
                              />
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const userIds = Object.keys(selectedNewMembers);
                          if (userIds.length === 0) return;
                          onAddMembers?.(userIds);
                          setSelectedNewMembers({});
                        }}
                        disabled={Object.keys(selectedNewMembers).length === 0}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs text-white transition hover:bg-cyan-500 disabled:opacity-60"
                      >
                        Add selected
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <GroupIntelligencePanel
            loading={intelligence?.loading}
            error={intelligence?.error}
            insights={intelligence?.insights ?? []}
            decisions={intelligence?.decisions ?? []}
            tasks={intelligence?.tasks ?? []}
          />

          <div className="rounded-2xl border border-white/10 bg-zinc-900/45 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Roles</div>
            <div className="mt-1 text-[11px] text-zinc-500">Promote members to admin or demote admins.</div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {group.members.map((member) => (
                <div key={member.id} className="rounded-xl border border-zinc-800 bg-zinc-900/65 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-zinc-100">
                        {member.user.name ?? member.user.username}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === "CREATOR" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                          <Crown size={12} />
                          Creator
                        </span>
                      )}
                      {member.role === "ADMIN" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                          <Shield size={12} />
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canManage && member.role !== "CREATOR" && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember?.(member.userId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-700/80 bg-rose-950/20 px-2 py-1 text-[10px] text-rose-300 transition hover:border-rose-500"
                      >
                        <UserMinus size={11} />
                        Remove
                      </button>
                    )}
                    {isCreator && member.role === "MEMBER" && (
                      <button
                        type="button"
                        onClick={() => onPromote?.(member.userId)}
                        className="rounded-lg border border-cyan-700/80 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-300 transition hover:border-cyan-500"
                      >
                        Make admin
                      </button>
                    )}
                    {isCreator && member.role === "ADMIN" && member.userId !== group.creatorId && (
                      <button
                        type="button"
                        onClick={() => onDemote?.(member.userId)}
                        className="rounded-lg border border-amber-700/80 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-300 transition hover:border-amber-500"
                      >
                        Remove admin
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-4">
            <div className="text-xs uppercase tracking-wide text-rose-300">Danger zone</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLeaveGroup}
                className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                Leave group
              </button>
              {isCreator && (
                <button
                  type="button"
                  onClick={onDeleteGroup}
                  className="rounded-lg border border-rose-700/80 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-300 transition hover:border-rose-500"
                >
                  Delete group
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
