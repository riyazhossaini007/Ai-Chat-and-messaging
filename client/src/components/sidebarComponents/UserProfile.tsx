import { User } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfileAccountCard, {
  type ProfileData,
  type UserType,
} from "../profileComponents/ProfileAccountCard";

interface UserProfileProps {
  open: boolean;
  user: UserType;
  onLogout: () => void;
  centered?: boolean;
  showProfileText?: boolean;
  onUpdateProfile?: (data: ProfileData) => void;
  onAvatarChange?: (file: File) => void;
  onDeleteAccount?: () => void;
  onOpenSettings?: () => void;
  isUpdating?: boolean;
  isUploading?: boolean;
  errorMessage?: string;
  successMessage?: string;
}

export default function UserProfile({
  open,
  user,
  onLogout,
  centered = false,
  showProfileText = false,
  onUpdateProfile,
  onAvatarChange,
  onDeleteAccount,
  onOpenSettings,
  isUpdating,
  isUploading,
  errorMessage,
  successMessage,
}: UserProfileProps) {
  const [showCard, setShowCard] = useState(false);
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  return (
    <div className={`px-2 py-2 border-t border-zinc-800 ${centered ? "flex justify-center" : ""}`}>
      <div
        className={`
          flex items-center gap-2 rounded-lg
          bg-zinc-900 hover:bg-zinc-800
          transition-all duration-300
          ${open ? "px-3 py-2" : "p-2 justify-center"}
          ${centered ? "justify-center" : "justify-between"}
        `}
      >
        {/* USER INFO */}
        <div className="flex items-center min-w-0">
          <button
            ref={avatarRef}
            type="button"
            onClick={() => setShowCard((prev) => !prev)}
            className="relative"
            aria-label="Open profile"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                className="w-8 h-8 rounded-full object-cover"
                alt="avatar"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-gradient flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
            )}
          </button>

          {/* Name (animated) */}
          <span
            className={`
              text-sm font-medium truncate
              transition-all duration-300 overflow-hidden 
              ${open ? "opacity-100 max-w-[140px] ml-2 " : "opacity-0 max-w-0"}
            `}
          >
            {user.name}
          </span>
        </div>

        {open && showProfileText && (
          <button
            onClick={() => setShowCard((prev) => !prev)}
            className="text-zinc-400 hover:text-white transition-colors text-xs"
            title="Profile"
          >
            Profile
          </button>
        )}
      </div>

      <ProfileAccountCard
        open={showCard}
        anchorRef={avatarRef}
        user={user}
        onClose={() => setShowCard(false)}
        onUpdateProfile={onUpdateProfile}
        onAvatarChange={onAvatarChange}
        onLogout={onLogout}
        onViewProfile={() => {
          setShowCard(false);
          navigate("/profilepage");
        }}
        onDeleteAccount={onDeleteAccount}
        onOpenSettings={onOpenSettings}
        isUpdating={isUpdating}
        isUploading={isUploading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />
    </div>
  );
}
