import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImageIcon, Paperclip, SendHorizontal, Square, Text } from "lucide-react";
import { fadeScaleVariant, optimizedMotionStyle } from "../../lib/motionVariants";

type AiMode = "text" | "image";

interface AiChatInputProps {
  onSend: (payload: {
    text: string;
    mode: AiMode;
    files: File[];
  }) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onCancel?: () => void;
}

export default function AiChatInput({
  onSend,
  disabled = false,
  isGenerating = false,
  onCancel,
}: AiChatInputProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AiMode>("text");
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeTextarea = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  const resetInputState = () => {
    setText("");
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSend = () => {
    if (disabled) return;
    if (!text.trim() && files.length === 0) return;
    onSend({ text: text.trim(), mode, files });
    resetInputState();
  };

  return (
    <div className="px-3 py-3 md:px-5 md:py-4">
      <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-2 backdrop-blur-xl">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-2 py-2">
          <button
            type="button"
            onClick={() => setMode(mode === "text" ? "image" : "text")}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              mode === "image"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
            }`}
            title={mode === "text" ? "Switch to image mode" : "Switch to text mode"}
          >
            {mode === "image" ? <ImageIcon size={16} /> : <Text size={16} />}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            title="Attach files"
          >
            <Paperclip size={16} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            disabled={disabled}
            rows={1}
            onInput={resizeTextarea}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              mode === "image"
                ? "Describe the image you want to generate..."
                : "Message Euclit..."
            }
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none max-h-40 overflow-y-auto placeholder:text-slate-500"
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />

          <motion.button
            type="button"
            onClick={isGenerating ? onCancel : handleSend}
            disabled={isGenerating ? false : disabled || (!text.trim() && files.length === 0)}
            animate={{ scale: text.trim() || files.length > 0 || isGenerating ? 1 : 0.95 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={optimizedMotionStyle}
            className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title={isGenerating ? "Stop generating" : "Send"}
          >
            {isGenerating ? <Square size={16} /> : <SendHorizontal size={18} />}
          </motion.button>
        </div>

        <AnimatePresence>
          {files.length > 0 && (
          <motion.div
            variants={fadeScaleVariant}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={optimizedMotionStyle}
            className="mt-2 flex items-center gap-2 flex-wrap px-1"
          >
            {files.map((file) => (
              <button
                type="button"
                key={`${file.name}-${file.size}`}
                onClick={() => {
                  setFiles((prev) => prev.filter((item) => item !== file));
                }}
                className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                title="Remove file"
              >
                {file.name}
              </button>
            ))}
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
