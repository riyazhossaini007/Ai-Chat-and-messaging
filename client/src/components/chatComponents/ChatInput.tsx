import { useEffect, useMemo, useRef, useState } from "react";
import {
  BsCameraVideo,
  BsFileEarmark,
  BsFillSendFill,
  BsGeoAlt,
  BsImage,
  BsMic,
  BsPerson,
  BsPlus,
  BsX,
} from "react-icons/bs";

export type ChatInputPayload = {
  text?: string;
  files?: File[];
  replyToId?: string;
};

export type ContactType = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
};

export default function AccountChatInput({
  onSend,
  replyTo,
  onCancelReply,
  onSendText,
  onUploadFile,
  onSendLocation,
  onAttachContact,
  onTyping,
  chatId,
  allowMultiple = true,
  maxFileSizeMB,
  isUploading,
  enterToSend = true,
}: {
  onSend: (payload: ChatInputPayload) => void;
  replyTo?: { id: string; senderName: string; preview: string };
  onCancelReply?: () => void;
  onSendText?: (text: string, chatId?: string) => void;
  onUploadFile?: (file: File, type: "image" | "video" | "audio" | "file", chatId?: string) => void;
  onSendLocation?: (location: { lat: number; lng: number }, chatId?: string) => void;
  onAttachContact?: (contact: ContactType, chatId?: string) => void;
  onTyping?: (chatId?: string) => void;
  chatId?: string;
  allowMultiple?: boolean;
  maxFileSizeMB?: number;
  isUploading?: boolean;
  enterToSend?: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [openMenu, setOpenMenu] = useState(false);
  const [pendingActions, setPendingActions] = useState<
    ({ type: "location"; payload: { lat: number; lng: number } } | { type: "contact"; payload: ContactType })[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previews]);

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      setOpenMenu(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenu]);

  const handleSend = () => {
    if (!text.trim() && files.length === 0 && pendingActions.length === 0) return;

    onSend({
      text: text.trim() || undefined,
      files: files.length ? files : undefined,
      replyToId: replyTo?.id,
    });
    if (text.trim()) {
      onSendText?.(text.trim(), chatId);
    }
    files.forEach((file) => {
      const type = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
        ? "audio"
        : "file";
      onUploadFile?.(file, type, chatId);
    });
    pendingActions.forEach((action) => {
      if (action.type === "location") {
        onSendLocation?.(action.payload, chatId);
      }
      if (action.type === "contact") {
        onAttachContact?.(action.payload, chatId);
      }
    });

    setText("");
    setFiles([]);
    setPendingActions([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCancelReply?.();
  };

  const handleOpenFilePicker = (type: "image" | "video" | "audio" | "file") => {
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        type === "image"
          ? "image/*"
          : type === "video"
          ? "video/*"
          : type === "audio"
          ? "audio/*"
          : "*";
      fileInputRef.current.multiple = allowMultiple;
      fileInputRef.current.click();
    }
    setOpenMenu(false);
  };

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const incoming = Array.from(selected);
    const filtered =
      typeof maxFileSizeMB === "number"
        ? incoming.filter((file) => file.size <= maxFileSizeMB * 1024 * 1024)
        : incoming;
    setFiles((prev) => (allowMultiple ? [...prev, ...filtered] : filtered));
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendLocation = () => {
    if (!onSendLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setPendingActions((prev) => [
        ...prev,
        { type: "location", payload: { lat: pos.coords.latitude, lng: pos.coords.longitude } },
      ]);
    });
    setOpenMenu(false);
  };

  const handleAttachContact = () => {
    if (!onAttachContact) return;
    const contact: ContactType = {
      id: crypto.randomUUID(),
      name: "New Contact",
    };
    setPendingActions((prev) => [
      ...prev,
      { type: "contact", payload: contact },
    ]);
    setOpenMenu(false);
  };

  return (
    <div ref={containerRef} className="relative border-t border-zinc-800 bg-zinc-950/80 backdrop-blur flex-shrink-0">
      {replyTo && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100">
          <div className="truncate">
            <span className="mr-2 text-indigo-300">{replyTo.senderName}</span>
            <span>{replyTo.preview}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="ml-3 rounded-lg px-2 py-1 text-xs text-indigo-100/80 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}

      {(files.length > 0 || pendingActions.length > 0) && (
        <div className="mx-4 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {previews.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="relative rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-200"
            >
              {item.file.type.startsWith("image/") && (
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="h-20 w-full rounded-lg object-cover"
                />
              )}
              {item.file.type.startsWith("video/") && (
                <video className="h-20 w-full rounded-lg object-cover" src={item.url} />
              )}
              {item.file.type.startsWith("audio/") && (
                <audio controls className="w-full">
                  <source src={item.url} />
                </audio>
              )}
              {!item.file.type.startsWith("image/") &&
                !item.file.type.startsWith("video/") &&
                !item.file.type.startsWith("audio/") && (
                  <div className="flex h-20 items-center justify-center rounded-lg bg-zinc-800/70">
                    {item.file.name}
                  </div>
                )}
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white/80 hover:text-white"
              >
                <BsX size={12} />
              </button>
            </div>
          ))}
          {pendingActions.map((action, index) => (
            <div
              key={`${action.type}-${index}`}
              className="relative flex h-20 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-200"
            >
              {action.type === "location" ? "Location attached" : "Contact attached"}
              <button
                type="button"
                onClick={() =>
                  setPendingActions((prev) => prev.filter((_, i) => i !== index))
                }
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white/80 hover:text-white"
              >
                <BsX size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
      {/* File Upload */}
      <button
        ref={plusRef}
        onClick={() => setOpenMenu((prev) => !prev)}
        className="
          p-3 rounded-xl
          bg-zinc-900 border border-zinc-800
          text-zinc-400
          hover:text-white hover:border-indigo-500/50
          transition
        "
        title="Attach file"
      >
        <BsPlus size={20} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        multiple={allowMultiple}
        hidden
        onChange={(e) => {
          handleFilesSelected(e.target.files);
        }}
      />

      {/* Text Input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          files.length
            ? `${files.length} file(s) attached`
            : "Type a message..."
        }
        rows={1}
        className="
          w-full resize-none
          bg-zinc-900 text-white
          rounded-2xl px-4 py-3
          outline-none
          border border-zinc-800
          focus:border-indigo-500/60
          focus:ring-2 focus:ring-indigo-500/20
          max-h-40
          placeholder-zinc-500
        "
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (enterToSend) {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            } else if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              handleSend();
            }
          }
          onTyping?.(chatId);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFilesSelected(e.dataTransfer.files);
        }}
      />

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!text.trim() && files.length === 0 && pendingActions.length === 0}
        className="
          flex w-12 h-12 items-center justify-center
          rounded-2xl
          bg-gradient-to-br from-indigo-500 to-purple-600
          text-white
          hover:opacity-90
          disabled:opacity-40
          transition
        "
      >
        <BsFillSendFill size={18} />
      </button>
      </div>

      {openMenu && (
        <div
          ref={menuRef}
          className="absolute left-4 bottom-full mb-3 z-50 w-[240px] max-w-[85vw] rounded-2xl border border-border-subtle bg-bg-elevated/95 p-2 shadow-lg backdrop-blur transition duration-150"
        >
          <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
            <button
              type="button"
              onClick={() => handleOpenFilePicker("image")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"
            >
              <BsImage /> Image / Photo
            </button>
            <button
              type="button"
              onClick={() => handleOpenFilePicker("video")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"
            >
              <BsCameraVideo /> Video
            </button>
            <button
              type="button"
              onClick={() => handleOpenFilePicker("audio")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"
            >
              <BsMic /> Audio
            </button>
            <button
              type="button"
              onClick={() => handleOpenFilePicker("file")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"
            >
              <BsFileEarmark /> File
            </button>
            <button
              type="button"
              onClick={handleSendLocation}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"
            >
              <BsGeoAlt /> Location
            </button>
            {onAttachContact && (
              <button
                type="button"
                onClick={handleAttachContact}
                className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"
              >
                <BsPerson /> Contact
              </button>
            )}
          </div>
          {typeof maxFileSizeMB === "number" && (
            <div className="mt-2 text-[11px] text-text-muted">
              Max file size: {maxFileSizeMB}MB
            </div>
          )}
          {isUploading && (
            <div className="mt-2 text-[11px] text-text-muted">
              Uploading...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
