import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SidebarMediaItem } from "./media";

type SidebarMediaListProps = {
  media: SidebarMediaItem[];
};

export default function SidebarMediaList({ media }: SidebarMediaListProps) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [previewItem, setPreviewItem] = useState<SidebarMediaItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const displayMedia = useMemo(() => media, [media]);

  useEffect(() => {
    setVisibleCount(12);
  }, [displayMedia.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 8, displayMedia.length));
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayMedia.length]);

  if (!displayMedia.length) {
    return (
      <div className="p-4 text-sm text-text-muted">
        No media yet.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-3">
        {displayMedia.slice(0, visibleCount).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPreviewItem(item)}
            className="group relative overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated/60 text-left"
          >
            {item.type === "image" ? (
              <img
                src={item.previewUrl}
                alt={item.title}
                className="h-24 w-full object-cover transition duration-300 group-hover:scale-105"
              />
            ) : item.type === "video" ? (
              <video
                src={item.previewUrl}
                muted
                playsInline
                className="h-24 w-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-full items-center justify-center bg-zinc-900/70 text-xs text-text-secondary">
                FILE
              </div>
            )}
            <div className="p-2">
              <div className="truncate text-xs text-text-primary">{item.title}</div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">{item.type}</div>
            </div>
          </button>
        ))}
      </div>

      <div ref={sentinelRef} className="h-4" />

      {previewItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
            onClick={() => setPreviewItem(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <div className="truncate text-sm text-text-primary">{previewItem.title}</div>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                >
                  Close
                </button>
              </div>
              <div className="bg-black">
                {previewItem.type === "image" ? (
                  <img
                    src={previewItem.fullUrl ?? previewItem.previewUrl}
                    alt={previewItem.title}
                    className="max-h-[80vh] w-full object-contain"
                  />
                ) : previewItem.type === "video" ? (
                  <video
                    src={previewItem.fullUrl ?? previewItem.previewUrl}
                    controls
                    autoPlay
                    className="max-h-[80vh] w-full"
                  />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center p-6">
                    <a
                      href={previewItem.fullUrl ?? previewItem.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2 text-sm text-text-primary hover:bg-white/5"
                    >
                      Open file
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
