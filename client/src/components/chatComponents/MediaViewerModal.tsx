import { useEffect, useMemo, useState, type WheelEvent } from "react";
import { motion } from "motion/react";
import { Download, Forward, Trash2, X } from "lucide-react";
import { fadeScaleVariant, optimizedMotionStyle } from "../../lib/motionVariants";

type MediaViewerModalProps = {
  type: "IMAGE" | "VIDEO";
  url: string;
  thumbnail?: string;
  layoutId?: string;
  caption?: string;
  onClose: () => void;
  onDelete?: () => void;
  onForward?: () => void;
  onDownload?: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function MediaViewerModal({
  type,
  url,
  thumbnail,
  layoutId,
  caption,
  onClose,
  onDelete,
  onForward,
  onDownload,
}: MediaViewerModalProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEsc);
    return () => {
      window.removeEventListener("keydown", closeOnEsc);
    };
  }, [onClose]);

  const canZoom = type === "IMAGE";
  const imageSource = useMemo(() => thumbnail || url, [thumbnail, url]);

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (!canZoom) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    setZoom((prev) => clamp(Number((prev + delta).toFixed(2)), 1, 4));
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] bg-black/95 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeInOut" } }}
    >
      <div className="flex h-full flex-col">
        <motion.div
          className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-200 transition hover:bg-white/10"
            aria-label="Close viewer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={onForward}
              className="rounded-full p-2 text-zinc-200 transition hover:bg-white/10"
              aria-label="Forward media"
            >
              <Forward size={18} />
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="rounded-full p-2 text-zinc-200 transition hover:bg-white/10"
              aria-label="Download media"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full p-2 text-rose-300 transition hover:bg-rose-500/15"
              aria-label="Delete media"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </motion.div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close media viewer"
          className="flex-1 cursor-default bg-transparent p-0"
        >
          <div
            className="flex h-full w-full items-center justify-center px-3 py-4 sm:px-5"
            onWheel={handleWheelZoom}
            onClick={(event) => event.stopPropagation()}
          >
            {type === "IMAGE" ? (
              <motion.img
                src={imageSource}
                alt={caption || "Shared image"}
                layoutId={layoutId}
                style={{ transform: `scale(${zoom})` }}
                className="max-h-full max-w-full select-none object-contain transition-transform duration-100"
                draggable={false}
              />
            ) : (
              <video
                src={url}
                className="max-h-full w-full max-w-5xl rounded-lg bg-black object-contain"
                controls
                autoPlay
              />
            )}
          </div>
        </button>

        {caption && (
          <motion.div
            variants={fadeScaleVariant}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={optimizedMotionStyle}
            className="border-t border-white/10 px-4 py-3 text-sm text-zinc-200"
          >
            {caption}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
