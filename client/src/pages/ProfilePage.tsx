import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Edit3, LogOut, Shield, Trash2, Upload, UserX } from "lucide-react";
import { patchMe } from "../api/user.api";
import { useAuthStore } from "../stores/authStore";
import { fadeScaleVariant, slidePanelVariant } from "../lib/motionVariants";
import { goHomeWithTransition } from "../lib/navigation";

type UserProfile = {
  name: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
  avatar: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  tone: "danger" | "default";
  onConfirm?: () => void;
};

type ProfileMeta = {
  email: string;
  bio: string;
};

const PROFILE_META_KEY = "plaxeai_profile_meta";

const INPUT_CLASS =
  "w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/70";

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-sm text-zinc-100">{value || "--"}</div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((store) => store.user);
  const updateAuthUser = useAuthStore((store) => store.updateUser);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialProfile = useMemo<UserProfile>(() => {
    let meta: ProfileMeta = { email: "user@example.com", bio: "Available" };
    const rawMeta = localStorage.getItem(PROFILE_META_KEY);
    if (rawMeta) {
      try {
        const parsed = JSON.parse(rawMeta) as Partial<ProfileMeta>;
        meta = {
          email: parsed.email?.trim() || "user@example.com",
          bio: parsed.bio?.trim() || "Available",
        };
      } catch {
        meta = { email: "user@example.com", bio: "Available" };
      }
    }

    if (authUser) {
      const username = authUser.username?.startsWith("@")
        ? authUser.username
        : `@${authUser.username || "user"}`;
      return {
        name: authUser.name || "User",
        username,
        email: meta.email,
        phone: authUser.phone || "",
        bio: meta.bio,
        avatar: authUser.avatar || "",
      };
    }

    return {
      name: "User",
      username: "@user",
      email: meta.email,
      phone: "",
      bio: meta.bio,
      avatar: "",
    };
  }, [authUser]);

  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [statusText, setStatusText] = useState(initialProfile.bio || "");
  const [isEditMode, setIsEditMode] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    tone: "default",
  });

  const [basicForm, setBasicForm] = useState({
    name: profile.name,
    username: profile.username,
    email: profile.email,
    phone: profile.phone,
    bio: profile.bio,
  });
  const [basicError, setBasicError] = useState("");

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (!authUser) return;
    setProfile((prev) => ({
      ...prev,
      name: authUser.name || prev.name,
      username: authUser.username?.startsWith("@")
        ? authUser.username
        : `@${authUser.username || prev.username.replace(/^@/, "")}`,
      phone: authUser.phone || prev.phone,
      avatar: authUser.avatar || "",
    }));
  }, [authUser]);

  const persistProfile = (next: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...next };
      localStorage.setItem(
        PROFILE_META_KEY,
        JSON.stringify({
          email: updated.email,
          bio: updated.bio,
        } as ProfileMeta)
      );
      return updated;
    });
  };

  const validateBasic = () => {
    if (!basicForm.name.trim()) return "Full name is required.";
    if (!basicForm.email.includes("@")) return "Please enter a valid email.";
    if (basicForm.bio.length > 180) return "Bio should be under 180 characters.";
    return "";
  };

  const handleSaveBasic = async () => {
    const error = validateBasic();
    if (error) {
      setBasicError(error);
      showToast(error, "error");
      return;
    }
    try {
      const username = basicForm.username.trim().replace(/^@/, "");
      const updatedUser = await patchMe({
        name: basicForm.name.trim(),
        username,
      });
      updateAuthUser(updatedUser);

      setBasicError("");
      persistProfile({
        name: updatedUser.name || basicForm.name.trim(),
        username: `@${updatedUser.username || username}`,
        email: basicForm.email.trim(),
        phone: updatedUser.phone || basicForm.phone.trim(),
        bio: basicForm.bio.trim(),
        avatar: updatedUser.avatar || profile.avatar,
      });
      setStatusText(basicForm.bio.trim());
      setIsEditMode(false);
      showToast("Basic information saved.");
    } catch {
      showToast("Could not save profile.", "error");
    }
  };

  const handleCancelBasic = () => {
    setBasicError("");
    setBasicForm({
      name: profile.name,
      username: profile.username,
      email: profile.email,
      phone: profile.phone,
      bio: profile.bio,
    });
    setIsEditMode(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    try {
      const avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      const updatedUser = await patchMe({ avatar });
      updateAuthUser(updatedUser);
      persistProfile({ avatar: updatedUser.avatar || avatar });
      showToast("Avatar updated.");
    } catch {
      showToast("Could not update avatar.", "error");
    }
  };

  const handleCopyProfileLink = async () => {
    const base = window.location.origin;
    const username = profile.username.startsWith("@") ? profile.username.slice(1) : profile.username;
    const link = `${base}/chat/${username}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Profile link copied.");
    } catch {
      showToast("Could not copy link.", "error");
    }
  };

  const handleUpdateStatus = () => {
    persistProfile({ bio: statusText.trim() });
    setBasicForm((prev) => ({ ...prev, bio: statusText.trim() }));
    showToast("Status updated.");
  };

  const handleSavePassword = () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError("All password fields are required.");
      showToast("Please fill all password fields.", "error");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      showToast("New password is too short.", "error");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Password confirmation does not match.");
      showToast("Password confirmation does not match.", "error");
      return;
    }
    setPasswordError("");
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setShowPasswordForm(false);
    showToast("Password changed successfully.");
  };

  const stats = [
    { label: "Joined", value: "Jan 2025" },
    { label: "Total chats", value: "184" },
    { label: "Groups joined", value: "12" },
    { label: "AI credits used", value: "72 / 120" },
  ];

  const sessions = [
    { device: "Windows PC - Chrome", lastActive: "Active now", location: "Kolkata, IN" },
    { device: "Android Phone - App", lastActive: "2 hours ago", location: "kolkata, IN" },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#020617] text-text-primary">
      <div className="pointer-events-none absolute -top-36 -left-28 h-[520px] w-[520px] bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -right-24 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)] blur-3xl" />
      <motion.div
        variants={slidePanelVariant}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-8">
        <button
          type="button"
          onClick={() => goHomeWithTransition(navigate)}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/80 to-emerald-300/75 font-bold text-zinc-950 shadow-[0_0_20px_-10px_rgba(34,211,238,0.9)] hover:opacity-95"
          aria-label="Back to home"
          title="Home"
        >
          P
        </button>

        <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-6">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-cyan-300/35 bg-zinc-900 md:h-24 md:w-24"
              aria-label="Change avatar"
              title="Change avatar"
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-primary-gradient" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] text-white">Change</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
            />

            <div className="flex-1">
              <div className="text-lg font-bold md:text-2xl">{profile.username}</div>
              <div className="mt-1 text-sm text-text-secondary md:text-base">{profile.name}</div>
              <div className="mt-2 text-sm text-text-muted">{profile.bio || "No status yet."}</div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  <Edit3 size={14} />
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  <Upload size={14} />
                  Change Avatar
                </button>
                <button
                  type="button"
                  onClick={handleCopyProfileLink}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  <Copy size={14} />
                  Copy Profile Link
                </button>
              </div>
            </div>

            <div className="w-full rounded-xl border border-cyan-400/20 bg-zinc-950/65 p-3 md:w-72">
              <label className="text-xs text-zinc-400">Update status</label>
              <textarea
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                rows={2}
                className="mt-2 w-full resize-none rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/70"
                placeholder="What are you up to?"
              />
              <button
                type="button"
                onClick={handleUpdateStatus}
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-cyan-300/85 to-emerald-300/80 px-3 py-2 text-sm text-zinc-950 hover:opacity-95"
              >
                Update Status
              </button>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Basic Information</h2>
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    className="rounded-lg border border-cyan-400/25 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                  >
                    Edit
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-text-muted">Inline editing with per-card save and validation feedback.</p>

              {isEditMode ? (
                <div className="mt-4 space-y-3">
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Full Name</span>
                    <input
                      className={INPUT_CLASS}
                      value={basicForm.name}
                      onChange={(e) => setBasicForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Username (limited edit)</span>
                    <input className={`${INPUT_CLASS} opacity-70`} value={basicForm.username} readOnly />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Email</span>
                    <input
                      className={INPUT_CLASS}
                      value={basicForm.email}
                      onChange={(e) => setBasicForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Phone</span>
                    <input
                      className={INPUT_CLASS}
                      value={basicForm.phone}
                      onChange={(e) => setBasicForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Bio / About</span>
                    <textarea
                      rows={3}
                      className={`${INPUT_CLASS} resize-none`}
                      value={basicForm.bio}
                      onChange={(e) => setBasicForm((prev) => ({ ...prev, bio: e.target.value }))}
                    />
                  </label>

                  {basicError && <div className="text-xs text-semantic-error">{basicError}</div>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBasic}
                      className="rounded-lg bg-gradient-to-r from-cyan-300/85 to-emerald-300/80 px-3 py-2 text-sm text-zinc-950 hover:opacity-95"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelBasic}
                      className="rounded-lg border border-cyan-400/25 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InfoField label="Full Name" value={profile.name} />
                  <InfoField label="Username" value={profile.username} />
                  <InfoField label="Email" value={profile.email} />
                  <InfoField label="Phone" value={profile.phone} />
                  <div className="md:col-span-2">
                    <InfoField label="Bio / About" value={profile.bio} />
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
              <h2 className="text-base font-semibold">Security</h2>
              <p className="mt-1 text-xs text-text-muted">Manage password and active device sessions.</p>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-cyan-400/20 bg-zinc-950/65 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Password</div>
                      <div className="text-xs text-text-muted">Use at least 8 characters.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm((v) => !v)}
                      className="rounded-lg border border-cyan-400/25 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      {showPasswordForm ? "Hide" : "Change password"}
                    </button>
                  </div>

                  {showPasswordForm && (
                    <div className="mt-3 grid gap-2">
                      <input
                        type="password"
                        placeholder="Current password"
                        className={INPUT_CLASS}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      />
                      <input
                        type="password"
                        placeholder="New password"
                        className={INPUT_CLASS}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      />
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        className={INPUT_CLASS}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      />
                      {passwordError && <div className="text-xs text-semantic-error">{passwordError}</div>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSavePassword}
                          className="rounded-lg bg-gradient-to-r from-cyan-300/85 to-emerald-300/80 px-3 py-2 text-sm text-zinc-950 hover:opacity-95"
                        >
                          Save password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswordError("");
                            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                          }}
                          className="rounded-lg border border-cyan-400/25 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-cyan-400/20 bg-zinc-950/65 p-3">
                  <div className="text-sm font-medium">Linked accounts</div>
                  <div className="mt-1 text-xs text-text-muted">Google / GitHub linking is coming soon.</div>
                </div>

                <div className="rounded-xl border border-cyan-400/20 bg-zinc-950/65 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Shield size={14} />
                    Active sessions
                  </div>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.device}
                        className="rounded-lg border border-cyan-400/20 bg-zinc-900/60 px-3 py-2"
                      >
                        <div className="text-sm text-text-primary">{session.device}</div>
                        <div className="mt-1 text-xs text-text-muted">
                          {session.location} · {session.lastActive}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
              <h2 className="text-base font-semibold">Account Stats</h2>
              <p className="mt-1 text-xs text-text-muted">Read-only account activity summary.</p>
              <div className="mt-4 space-y-2">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
                    <div className="text-xs text-text-muted">{item.label}</div>
                    <div className="mt-1 text-sm text-text-primary">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-semantic-error/35 bg-zinc-900/55 p-4 shadow-[0_24px_70px_-52px_rgba(244,63,94,0.55)] md:p-5">
              <h2 className="text-base font-semibold text-semantic-error">Danger Zone</h2>
              <p className="mt-1 text-xs text-text-muted">
                High-impact actions are separated and require confirmation.
              </p>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      open: true,
                      title: "Logout from all devices?",
                      message: "This will end all active sessions and require sign-in again.",
                      confirmText: "Logout all",
                      tone: "danger",
                      onConfirm: () => showToast("Logged out from all devices."),
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-semantic-error/40 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error/10"
                >
                  <LogOut size={14} />
                  Logout all devices
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      open: true,
                      title: "Deactivate account?",
                      message: "Your profile becomes hidden until you reactivate by signing in.",
                      confirmText: "Deactivate",
                      tone: "danger",
                      onConfirm: () => showToast("Account deactivated.", "error"),
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-semantic-error/40 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error/10"
                >
                  <UserX size={14} />
                  Deactivate account
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      open: true,
                      title: "Delete account permanently?",
                      message: "This cannot be undone. All messages and account data will be removed.",
                      confirmText: "Delete account",
                      tone: "danger",
                      onConfirm: () => showToast("Delete request submitted.", "error"),
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-semantic-error/40 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error/10"
                >
                  <Trash2 size={14} />
                  Delete account
                </button>
              </div>
            </section>
          </div>
        </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && (
        <motion.div
          variants={fadeScaleVariant}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed right-4 top-4 z-[70]"
        >
          <motion.div
            className={`rounded-xl border px-4 py-2 text-sm shadow-lg backdrop-blur ${toast.tone === "error"
                ? "border-semantic-error/40 bg-semantic-error/10 text-semantic-error"
                : "border-cyan-400/40 bg-zinc-900/90 text-text-primary"
              }`}
          >
            {toast.message}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {confirm.open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
          exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
        >
          <motion.div
            variants={fadeScaleVariant}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-md rounded-2xl border border-cyan-400/20 bg-zinc-900/95 p-5 shadow-[0_35px_80px_-55px_rgba(6,182,212,0.9)] backdrop-blur-xl"
          >
            <div className="text-lg font-semibold text-white">{confirm.title}</div>
            <div className="mt-2 text-sm text-zinc-300">{confirm.message}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm((prev) => ({ ...prev, open: false, onConfirm: undefined }))}
                className="rounded-lg border border-cyan-400/25 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirm.onConfirm?.();
                  setConfirm((prev) => ({ ...prev, open: false, onConfirm: undefined }));
                }}
                className={`rounded-lg px-4 py-2 text-sm text-white ${confirm.tone === "danger" ? "bg-semantic-error hover:opacity-90" : "bg-primary-gradient hover:opacity-90"
                  }`}
              >
                {confirm.confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
