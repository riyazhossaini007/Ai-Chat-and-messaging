import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UniversalContainer } from "../containers/UniversalContainer";
import ProfileAccountCard, { type UserType } from "../components/profileComponents/ProfileAccountCard";
import { Sparkles, Home as HomeIcon, MessageCircle, Users,Settings } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import icon from "../assets/icon.png";

export default function Home() {
  const authUser = useAuthStore((store) => store.user);
  const clearSession = useAuthStore((store) => store.clearSession);
  const unreadSummary = useChatStore((store) => store.unreadSummary);
  const [showProfile, setShowProfile] = useState(false);
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: "home", label: "Home", icon: HomeIcon, path: "/home" },
    { id: "chat", label: "Chat", icon: MessageCircle, path: "/chat" },
    { id: "groups", label: "Groups", icon: Users, path: "/groups" },
    { id: "ai", label: "AI", icon: Sparkles, path: "/ai" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ] as const;

  const isActive = (path: string) => {
    if (path === "/home") {
      return location.pathname === "/home" || location.pathname === "/";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const user = useMemo<UserType>(() => {
    return {
      name: authUser?.name || "User",
      username: authUser?.username ? `@${authUser.username}` : "@user",
      email: "",
      phone: authUser?.phone || "",
      bio: "",
      avatar: authUser?.avatar || "",
    };
  }, [authUser?.avatar, authUser?.name, authUser?.phone, authUser?.username]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 20) return "Good evening";
    return "Good night";
  }, []);

  return (
    <div className="relative flex bg-bg-main w-full h-screen overflow-hidden">
      {/* Thin Sidebar */}
      <aside className="flex h-screen w-14 flex-col items-center border-r border-cyan-400/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 py-3 text-text-primary backdrop-blur-xl">
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/45 bg-zinc-950/85 shadow-[0_0_24px_-12px_rgba(34,211,238,0.95)] transition hover:border-cyan-200/70 hover:shadow-[0_0_28px_-10px_rgba(34,211,238,1)]"
          aria-label="Go to home"
          title="Home"
        >
          <img src={icon} alt="Euclit logo" className="h-7 w-7 object-contain" />
        </button>

        <div className="flex flex-col gap-2 pt-4">
          {navItems.map(({ id, label, icon: Icon, path }) => {
            const active = isActive(path);
            const badgeCount =
              id === "chat"
                ? unreadSummary.direct
                : id === "groups"
                ? unreadSummary.group
                : 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigate(path)}
                className={`relative group flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  active
                    ? "border-cyan-400/45 bg-cyan-400/15 text-white"
                    : "border-transparent text-text-muted hover:border-cyan-400/25 hover:bg-white/5 hover:text-white"
                }`}
                aria-label={label}
                title={label}
              >
                <Icon size={18} />
                {badgeCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-[10px] leading-5 text-white text-center">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary-gradient" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Profile */}
        <button
          ref={avatarRef}
          onClick={() => setShowProfile((prev) => !prev)}
          className="h-10 w-10 overflow-hidden rounded-full border border-cyan-400/35 bg-bg-elevated shadow-[0_0_22px_-12px_rgba(34,211,238,0.85)]"
          aria-label="Open profile"
          title="Profile"
        >
          {user.avatar ? (
            <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-primary-gradient" />
          )}
        </button>
      </aside>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-glow blur-3xl pointer-events-none" />

        {/* Main Content */}
        <div className="relative z-10 flex flex-1 flex-col w-full gap-20 justify-center items-center px-6 pb-32">
          {/* Greeting */}
          <h1 className="text-3xl md:text-4xl font-semibold text-text-primary text-center">
            {greeting},{" "}
            <span className="bg-primary-gradient bg-clip-text text-transparent">
              {authUser?.name ?? "User"}
            </span>
          </h1>

          {/* Search / Universal input */}
          <div className="w-full max-w-2xl items-center justify-center">
            <UniversalContainer />
          </div>
        </div>
      </div>

      <ProfileAccountCard
        open={showProfile}
        anchorRef={avatarRef}
        user={user}
        onClose={() => setShowProfile(false)}
        onLogout={() => {
          setShowProfile(false);
          clearSession();
          navigate("/login", { replace: true });
        }}
        onViewProfile={() => {
          setShowProfile(false);
          navigate("/profilepage");
        }}
        onOpenSettings={() => {
          setShowProfile(false);
          navigate("/settings");
        }}
      />
    </div>
  );
}
