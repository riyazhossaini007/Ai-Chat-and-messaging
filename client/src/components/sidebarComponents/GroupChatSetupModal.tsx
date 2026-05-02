import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera } from "lucide-react";
import { motion } from "motion/react";

export type GroupCreatePayload = {
  name: string;
  description?: string;
  avatar?: File;
  members: string[];
  settings: {
    visibility: "private" | "public";
    sendPermission: "admins" | "all";
  };
};

export type GroupMember = {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  phone?: string;
};

type GroupChatSetupModalProps = {
  open: boolean;
  onClose: () => void;
  onCreateGroup: (data: GroupCreatePayload) => Promise<void> | void;
  users: GroupMember[];
  isLoading?: boolean;
  errorMessage?: string;
};

const steps = ["Group Info", "Add Members", "Settings", "Review"];

export default function GroupChatSetupModal({
  open,
  onClose,
  onCreateGroup,
  users,
  isLoading,
  errorMessage,
}: GroupChatSetupModalProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<File | undefined>(undefined);
  const avatarPreview = useMemo(
    () => (avatar ? URL.createObjectURL(avatar) : ""),
    [avatar]
  );

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [sendPermission, setSendPermission] = useState<"admins" | "all">("all");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q)
    );
  }, [search, users]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canNext =
    (step === 0 && name.trim().length > 2) ||
    (step === 1 && selectedIds.length > 0) ||
    step === 2 ||
    step === 3;

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.length === 0) return;
    setLocalError(null);
    setSubmitting(true);
    try {
      await onCreateGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        avatar,
        members: selectedIds,
        settings: {
          visibility,
          sendPermission,
        },
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create group";
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
    >
      <motion.div
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated/95 backdrop-blur text-text-primary"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
        exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Create Group</h2>
            <p className="text-xs text-text-muted">Step {step + 1} of 4</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-4 border-b border-border-subtle px-5 py-3 text-xs uppercase tracking-widest text-text-muted">
          {steps.map((label, index) => (
            <div
              key={label}
              className={index === step ? "text-text-primary" : ""}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-[140px_1fr]">
              <div className="flex flex-col items-center gap-2">
                <div className="h-24 w-24 rounded-2xl border border-border-subtle bg-bg-surface flex items-center justify-center overflow-hidden">
                  {avatar ? (
                    <img
                      src={avatarPreview}
                      alt="Group avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-text-muted">No Image</div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                  <Camera size={14} />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setAvatar(e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-muted">Group Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
                    placeholder="e.g. Project Atlas"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
                placeholder="Search by username, name, or phone"
              />
              <div className="flex flex-wrap gap-2">
                {selectedIds.map((id) => {
                  const u = users.find((x) => x.id === id);
                  if (!u) return null;
                  return (
                    <span
                      key={id}
                      className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-xs"
                    >
                      {u.name}
                    </span>
                  );
                })}
              </div>
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      selectedIds.includes(u.id)
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full overflow-hidden border border-border-subtle bg-bg-surface">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-primary-gradient" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm">{u.name}</div>
                      <div className="text-xs text-text-muted">{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-text-muted">Visibility</div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility("private")}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      visibility === "private"
                        ? "border-primary-blue bg-primary-blue/10 text-white"
                        : "border-border-subtle"
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      visibility === "public"
                        ? "border-primary-blue bg-primary-blue/10 text-white"
                        : "border-border-subtle"
                    }`}
                  >
                    Public
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Messaging permissions</div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSendPermission("admins")}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      sendPermission === "admins"
                        ? "border-primary-blue bg-primary-blue/10 text-white"
                        : "border-border-subtle"
                    }`}
                  >
                    Only admins
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendPermission("all")}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      sendPermission === "all"
                        ? "border-primary-blue bg-primary-blue/10 text-white"
                        : "border-border-subtle"
                    }`}
                  >
                    Everyone
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2">
                <div className="text-xs text-text-muted">Group Name</div>
                <div>{name}</div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2">
                <div className="text-xs text-text-muted">Members</div>
                <div>{selectedIds.length}</div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2">
                <div className="text-xs text-text-muted">Visibility</div>
                <div>{visibility}</div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2">
                <div className="text-xs text-text-muted">Send Permission</div>
                <div>{sendPermission === "admins" ? "Only admins" : "Everyone"}</div>
              </div>
            </div>
          )}
        </div>

        {(localError || errorMessage) && (
          <div className="px-5 text-sm text-semantic-error">{localError ?? errorMessage}</div>
        )}

        <div className="flex items-center justify-between border-t border-border-subtle px-5 py-4">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
            className="text-sm text-text-muted hover:text-text-primary"
            disabled={step === 0}
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => Math.min(3, prev + 1))}
                disabled={!canNext}
                className="rounded-lg bg-primary-gradient px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void handleCreate();
                }}
                disabled={isLoading || submitting || !canNext}
                className="rounded-lg bg-primary-gradient px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isLoading || submitting ? "Creating..." : "Create Group"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
