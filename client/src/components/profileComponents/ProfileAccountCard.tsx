import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { LogOut, Settings, Trash2, X } from "lucide-react";
import { motion } from "motion/react";

export type ProfileData = {
  name: string;
  username: string;
  email: string;
  phone?: string;
  bio?: string;
};

export type UserType = ProfileData & {
  avatar?: string;
};

type ProfileAccountCardProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  user: UserType;
  onClose: () => void;
  onUpdateProfile?: (data: ProfileData) => void;
  onAvatarChange?: (file: File) => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  onOpenSettings?: () => void;
  onViewProfile?: () => void;
  isUpdating?: boolean;
  isUploading?: boolean;
  errorMessage?: string;
  successMessage?: string;
};

export default function ProfileAccountCard({
  open,
  anchorRef,
  user,
  onClose,
  onLogout,
  onDeleteAccount,
  onOpenSettings,
  onViewProfile,
  isUploading,
  errorMessage,
  successMessage,
}: ProfileAccountCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [align, setAlign] = useState<"left" | "right">("left");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const summary = useMemo<ProfileData>(() => {
    return {
      name: user.name ?? "",
      username: user.username ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      bio: user.bio ?? "",
    };
  }, [user.bio, user.email, user.name, user.phone, user.username]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const card = cardRef.current;
      if (!anchor || !card) return;

      const anchorRect = anchor.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const gap = 10;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = anchorRect.bottom + gap;
      let nextPlacement: "top" | "bottom" = "bottom";
      if (top + cardRect.height > viewportHeight - gap) {
        nextPlacement = "top";
        top = anchorRect.top - cardRect.height - gap;
      }
      if (top < gap) top = gap;

      let left = anchorRect.left;
      let nextAlign: "left" | "right" = "left";
      if (left + cardRect.width > viewportWidth - gap) {
        left = anchorRect.right - cardRect.width;
        nextAlign = "right";
      }
      if (left < gap) left = gap;

      setPlacement(nextPlacement);
      setAlign(nextAlign);
      setStyle({ top: Math.round(top), left: Math.round(left) });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (cardRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) {
      setConfirmLogout(false);
    }
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label="Profile settings"
      data-placement={placement}
      data-align={align}
      style={style}
      className="fixed z-50 w-[320px] max-w-[92vw] rounded-2xl border border-cyan-400/25 bg-zinc-900/95 p-4 shadow-[0_35px_80px_-55px_rgba(6,182,212,0.9)] backdrop-blur-xl transition"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, transition: { duration: 0.16, ease: "easeOut" } }}
      exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.16, ease: "easeInOut" } }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt="Profile"
                className="h-14 w-14 rounded-full border border-cyan-300/35 object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-full border border-cyan-300/35 bg-gradient-to-br from-cyan-300/80 to-emerald-300/75" />
            )}
          </div>
          <div>
            <div className="text-base font-semibold text-white">
              {user.name || "Profile"}
            </div>
            <div className="text-xs text-zinc-300">{user.username}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:text-white"
          aria-label="Close profile card"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
          <div className="text-xs text-zinc-400">Full Name</div>
          <div className="mt-1 text-zinc-100">{summary.name || "--"}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
          <div className="text-xs text-zinc-400">Username</div>
          <div className="mt-1 text-zinc-100">{summary.username || "--"}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
          <div className="text-xs text-zinc-400">Email</div>
          <div className="mt-1 text-zinc-100">{summary.email || "--"}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
          <div className="text-xs text-zinc-400">Phone</div>
          <div className="mt-1 text-zinc-100">{summary.phone || "--"}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/65 px-3 py-2">
          <div className="text-xs text-zinc-400">Status / Bio</div>
          <div className="mt-1 whitespace-pre-line text-zinc-100">
            {summary.bio || "--"}
          </div>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className="mt-3 text-xs">
          {errorMessage && <div className="text-semantic-error">{errorMessage}</div>}
          {successMessage && <div className="text-semantic-success">{successMessage}</div>}
        </div>
      )}

      {isUploading && (
        <div className="mt-4 text-xs text-zinc-400">Uploading avatar...</div>
      )}

      <div className="mt-4 space-y-2 border-t border-cyan-400/20 pt-3">
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-200 hover:border-cyan-400/25 hover:bg-white/5"
          >
            <Settings size={14} />
            Settings
          </button>
        )}
        {onViewProfile ? (
          <div className="flex items-center gap-2">
            {onLogout && (
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex flex-1 items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-semantic-error hover:border-semantic-error/30 hover:bg-white/5"
              >
                <LogOut size={14} />
                Logout
              </button>
            )}
            <button
              type="button"
              onClick={onViewProfile}
              className={`flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-200 hover:border-cyan-400/25 hover:bg-white/5 ${onLogout ? "flex-1" : "w-full"}`}
            >
              View
            </button>
          </div>
        ) : (
          onLogout && (
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-semantic-error hover:border-semantic-error/30 hover:bg-white/5"
            >
              <LogOut size={14} />
              Logout
            </button>
          )
        )}
        {confirmLogout && (
          <div className="rounded-lg border border-cyan-400/20 bg-zinc-950/70 px-3 py-3">
            <div className="text-sm text-zinc-100">Are you sure you want to log out?</div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-md border border-cyan-400/25 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLogout(false);
                  onLogout?.();
                }}
                className="flex-1 rounded-md bg-semantic-error px-3 py-1.5 text-xs text-white hover:opacity-90"
              >
                Logout
              </button>
            </div>
          </div>
        )}
        {onDeleteAccount && (
          <button
            type="button"
            onClick={onDeleteAccount}
            className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-semantic-error hover:border-semantic-error/30 hover:bg-white/5"
          >
            <Trash2 size={14} />
            Delete Account
          </button>
        )}
      </div>
    </motion.div>
  , document.body);
}

