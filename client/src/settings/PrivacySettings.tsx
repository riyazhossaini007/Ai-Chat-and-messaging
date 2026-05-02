import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../api/api";
import { useSettingsStore } from "../stores/settingsStore";
import type { SettingsSectionProps } from "./SettingsLayout";

const FIELD_CLASS =
  "w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/70";

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className={`rounded-xl border border-cyan-400/20 bg-zinc-950/60 p-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-text-primary">{label}</div>
          <div className="mt-1 text-xs text-text-muted">{description}</div>
        </div>
        <button
          type="button"
          onClick={onChange}
          disabled={disabled}
          className={`h-6 w-11 rounded-full border transition ${
            checked
              ? "border-cyan-300/45 bg-gradient-to-r from-cyan-300/85 to-emerald-300/80"
              : "border-cyan-400/20 bg-zinc-950/75"
          } ${disabled ? "cursor-not-allowed" : ""}`}
          aria-pressed={checked}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition ${
              checked ? "translate-x-[20px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

const lastSeenPreview = (value: "everyone" | "contacts" | "nobody") => {
  if (value === "everyone") return "Everyone can see your last active time.";
  if (value === "contacts") return "Contacts will see your last active time.";
  return "Nobody can see your last active time.";
};

const profilePhotoPreview = (value: "everyone" | "contacts" | "nobody") => {
  if (value === "everyone") return "Everyone can view your profile photo.";
  if (value === "contacts") return "Only contacts can view your profile photo.";
  return "Nobody can view your profile photo.";
};

export default function PrivacySettings({
  showToast,
  requestConfirm,
}: SettingsSectionProps) {
  const settings = useSettingsStore((state) => state.settings);
  const isLoading = useSettingsStore((state) => state.isLoading);
  const fieldSaving = useSettingsStore((state) => state.fieldSaving);
  const privacyError = useSettingsStore((state) => state.privacyError);
  const blockedUsers = useSettingsStore((state) => state.blockedUsers);
  const patchSettings = useSettingsStore((state) => state.patchSettings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadBlockedUsers = useSettingsStore((state) => state.loadBlockedUsers);
  const blockUser = useSettingsStore((state) => state.blockUser);
  const unblockUser = useSettingsStore((state) => state.unblockUser);

  const [search, setSearch] = useState("");
  const [blockInput, setBlockInput] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  const lastSeen = settings?.lastSeen ?? "contacts";
  const profilePhoto = settings?.profilePhoto ?? "everyone";
  const readReceipts = settings?.readReceipts ?? true;
  const allowMessagesFromNonContacts = settings?.allowMessagesFromNonContacts ?? true;
  const twoFactorState = settings?.twoFactor.state ?? "OFF";
  const twoFactorEnabled = twoFactorState !== "OFF";

  const isSavingLastSeen = Boolean(fieldSaving.lastSeen);
  const isSavingProfilePhoto = Boolean(fieldSaving.profilePhoto);
  const isSavingReadReceipts = Boolean(fieldSaving.readReceipts);
  const isSavingAllowMessages = Boolean(fieldSaving.allowMessagesFromNonContacts);
  const isSavingTwoFactor = Boolean(fieldSaving.twoFactorEnabled);

  useEffect(() => {
    void loadBlockedUsers().catch((error: unknown) => {
      showToast(getApiErrorMessage(error), "danger");
    });
  }, [loadBlockedUsers, showToast]);

  const filteredBlockedUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return blockedUsers;
    return blockedUsers.filter((item) => item.username.toLowerCase().includes(q));
  }, [blockedUsers, search]);

  const patchWithRecovery = async (
    patch: Parameters<typeof patchSettings>[0],
    successMessage: string
  ) => {
    setInlineError(null);
    try {
      await patchSettings(patch);
      showToast(successMessage);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setInlineError(message);
      showToast(message, "danger");
      await loadSettings().catch(() => undefined);
      throw error;
    }
  };

  const handleUnblock = async (userId: string, username: string) => {
    const confirmed = await requestConfirm({
      title: "Unblock user?",
      body: `Messages from @${username} can reach you again (subject to your privacy rules).`,
      confirmLabel: "Unblock",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await unblockUser(userId);
      showToast(`@${username} unblocked`);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setInlineError(message);
      showToast(message, "danger");
    }
  };

  const handleBlockByUsername = async () => {
    const username = blockInput.replace(/^@/, "").trim();
    if (!username) return;
    setInlineError(null);
    try {
      await blockUser({ username });
      setBlockInput("");
      showToast(`@${username} blocked`);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setInlineError(message);
      showToast(message, "danger");
    }
  };

  const handleTwoFactorToggle = async () => {
    const enabling = !twoFactorEnabled;
    const confirmed = await requestConfirm({
      title: enabling ? "Enable two-factor authentication?" : "Disable two-factor authentication?",
      body: enabling
        ? "2FA will be enabled in setup mode until you finish configuration."
        : "Disabling 2FA lowers account security.",
      confirmLabel: enabling ? "Enable 2FA" : "Disable 2FA",
      tone: "danger",
    });
    if (!confirmed) return;

    await patchWithRecovery(
      { twoFactorEnabled: enabling },
      enabling ? "2FA enabled (setup required)" : "2FA disabled"
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Visibility</h3>
        <p className="mt-1 text-xs text-text-muted">Choose who can view your activity and profile details.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Last seen visibility</span>
            <select
              className={FIELD_CLASS}
              value={lastSeen}
              disabled={isLoading || isSavingLastSeen}
              onChange={(e) => {
                const next = e.target.value as "everyone" | "contacts" | "nobody";
                void patchWithRecovery({ lastSeen: next }, "Last seen visibility saved");
              }}
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">My contacts</option>
              <option value="nobody">Nobody</option>
            </select>
            <p className="text-[11px] text-text-muted">{lastSeenPreview(lastSeen)}</p>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Profile photo visibility</span>
            <select
              className={FIELD_CLASS}
              value={profilePhoto}
              disabled={isLoading || isSavingProfilePhoto}
              onChange={(e) => {
                const next = e.target.value as "everyone" | "contacts" | "nobody";
                void patchWithRecovery({ profilePhoto: next }, "Profile photo visibility saved");
              }}
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">My contacts</option>
              <option value="nobody">Nobody</option>
            </select>
            <p className="text-[11px] text-text-muted">
              {profilePhotoPreview(profilePhoto)} Blocked users cannot see this anyway.
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Security</h3>
        <p className="mt-1 text-xs text-text-muted">
          Read receipts policy applies to both direct and group messages.
        </p>

        <div className="mt-4 space-y-3">
          <Toggle
            label="Allow messages from non-contacts"
            description="If disabled, only contacts and existing DM conversations can message you."
            checked={allowMessagesFromNonContacts}
            disabled={isLoading || isSavingAllowMessages}
            onChange={() => {
              const next = !allowMessagesFromNonContacts;
              void patchWithRecovery({ allowMessagesFromNonContacts: next }, "Message privacy setting saved");
            }}
          />
          <Toggle
            label="Read receipts"
            description="If disabled, others won't see when you read messages (DMs and groups)."
            checked={readReceipts}
            disabled={isLoading || isSavingReadReceipts}
            onChange={() => {
              void patchWithRecovery({ readReceipts: !readReceipts }, "Read receipt preference saved");
            }}
          />
          <Toggle
            label="Two-factor authentication (2FA)"
            description="OFF, SETUP_REQUIRED, and ON states are supported."
            checked={twoFactorEnabled}
            disabled={isLoading || isSavingTwoFactor}
            onChange={() => {
              void handleTwoFactorToggle();
            }}
          />
          {twoFactorState === "SETUP_REQUIRED" && (
            <button
              type="button"
              className="rounded-lg border border-cyan-300/40 bg-gradient-to-r from-cyan-300/85 to-emerald-300/80 px-3 py-2 text-xs font-medium text-zinc-950"
              onClick={() => {
                showToast("2FA setup flow is coming next (phase 2).");
              }}
            >
              Finish setup
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Blocked Users</h3>
        <p className="mt-1 text-xs text-text-muted">Blocked users are stored by user ID for stable unblocking.</p>

        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            className={FIELD_CLASS}
            placeholder="Search blocked users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex w-full gap-2 md:max-w-md">
            <input
              className={FIELD_CLASS}
              placeholder="Block by username"
              value={blockInput}
              onChange={(e) => setBlockInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                void handleBlockByUsername();
              }}
              className="rounded-lg border border-cyan-400/25 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5"
            >
              Block
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {filteredBlockedUsers.length === 0 && (
            <div className="rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-3 text-sm text-zinc-300">
              No blocked users.
            </div>
          )}

          {filteredBlockedUsers.map((user) => (
            <div
              key={user.userId}
              className="flex items-center justify-between rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-2"
            >
              <div>
                <div className="text-sm text-text-primary">@{user.username}</div>
                <div className="text-[11px] text-text-muted">
                  Blocked {new Date(user.blockedAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleUnblock(user.userId, user.username);
                }}
                className="rounded-lg border border-semantic-error/40 px-3 py-1 text-xs text-semantic-error hover:bg-semantic-error/10"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      </section>

      {(inlineError || privacyError) && (
        <div className="rounded-xl border border-semantic-error/40 bg-semantic-error/10 px-3 py-2 text-xs text-semantic-error">
          {inlineError || privacyError}
        </div>
      )}
    </div>
  );
}
