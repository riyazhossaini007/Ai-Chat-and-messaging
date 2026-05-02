import type { CSSProperties } from "react";
import { forwardRef } from "react";
import { createPortal } from "react-dom";

export type MessageActionId =
  | "share"
  | "delete"
  | "copy"
  | "reply"
  | "forward"
  | "star"
  | "regenerate";

export type MessageAction = {
  id: MessageActionId;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
};

type MessageActionMenuProps = {
  open: boolean;
  actions: MessageAction[];
  placement: "top" | "bottom";
  align: "left" | "right" | "center";
  style?: CSSProperties;
  quickReactions?: string[];
  onReact?: (emoji: string) => void;
};

const MessageActionMenu = forwardRef<HTMLDivElement, MessageActionMenuProps>(
  ({ open, actions, placement, align, style, quickReactions, onReact }, ref) => {
    if (!open) return null;

    const content = (
      <div
        ref={ref}
        role="menu"
        data-placement={placement}
        data-align={align}
        style={style}
        className="fixed z-50 w-[260px] max-w-[85vw] rounded-2xl border border-border-subtle bg-bg-elevated/95 p-2 shadow-lg backdrop-blur"
      >
        {quickReactions && quickReactions.length > 0 && onReact && (
          <div className="mb-2 flex items-center gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-1">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-1">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              onClick={action.onSelect}
              data-tone={action.tone ?? "default"}
              className="flex items-center justify-center rounded-xl px-2 py-2 text-[12px] font-medium text-text-secondary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue data-[tone=danger]:text-semantic-error"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );

    if (typeof document === "undefined") {
      return content;
    }

    return createPortal(content, document.body);
  }
);

MessageActionMenu.displayName = "MessageActionMenu";

export default MessageActionMenu;
