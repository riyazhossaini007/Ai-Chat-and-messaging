import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useChatContextStore } from "../stores/chatContextStore";
import { useMainSidebarStore } from "../stores/mainSidebarStore";
import { useUiStore } from "../stores/uiStore";
import { useNavigationStore } from "../stores/navigationStore";

const TITLE = "404 - Page Not Found";
const DESCRIPTION =
  "The page you're looking for doesn't exist. The link may be broken or removed. Let's get you back to your conversations.";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const clearSelection = useChatContextStore((state) => state.clearSelection);
  const resetSidebar = useMainSidebarStore((state) => state.resetSidebar);
  const closeModal = useUiStore((state) => state.closeModal);
  const closeMobileSidebar = useNavigationStore(
    (state) => state.closeMobileSidebar
  );

  useEffect(() => {
    clearSelection();
    resetSidebar();
    closeModal();
    closeMobileSidebar();
  }, [clearSelection, resetSidebar, closeModal, closeMobileSidebar]);

  const isAuthenticated = useMemo(() => {
    if (typeof window === "undefined") return false;

    return Boolean(
      localStorage.getItem("plaxeai_token") ||
        localStorage.getItem("plaxeai_user") ||
        localStorage.getItem("token")
    );
  }, []);

  const primaryLabel = isAuthenticated ? "Go to Chats" : "Go to Login";
  const primaryHref = isAuthenticated ? "/chat" : "/login";

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-bg-main px-5 py-8 md:px-8">
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-primary-glow blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary-glow blur-3xl opacity-50" />

      <section className="relative z-10 w-full max-w-[560px] rounded-3xl border border-border-subtle bg-bg-surface/95 p-7 text-center shadow-glow-sm md:p-10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-gradient text-xl font-bold text-black shadow-glow-sm">
          P
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Message Failed to Deliver
        </p>
        <h1 className="text-3xl font-semibold text-text-primary md:text-4xl">
          {TITLE}
        </h1>
        <p className="mx-auto mt-4 max-w-[44ch] text-sm leading-relaxed text-text-secondary md:text-base">
          {DESCRIPTION}
        </p>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={() => navigate(primaryHref)}
            className="w-full rounded-xl bg-primary-gradient px-4 py-3 text-sm font-semibold text-black transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={handleGoBack}
            className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm font-semibold text-text-primary transition hover:border-border-strong hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary-indigo"
          >
            Go Back
          </button>
        </div>

        <p className="mt-6 text-xs text-text-muted">
          {location.pathname}
        </p>
      </section>
    </main>
  );
}
