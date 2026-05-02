import type { MediaScope } from "./media";

type MediaScopeSelectorProps = {
  value: MediaScope;
  onChange: (scope: MediaScope) => void;
  canSelectThisChat: boolean;
  onViewAllMedia?: () => void;
};

export default function MediaScopeSelector({
  value,
  onChange,
  canSelectThisChat,
  onViewAllMedia,
}: MediaScopeSelectorProps) {
  return (
    <div className="mt-2 px-3 pb-2">
      <div className="grid grid-cols-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-1">
        <button
          type="button"
          disabled={!canSelectThisChat}
          onClick={() => onChange("chat")}
          className={`rounded-md px-2 py-1 text-xs transition ${
            value === "chat"
              ? "bg-primary-gradient text-black"
              : "text-text-muted hover:text-text-primary"
          } ${!canSelectThisChat ? "cursor-not-allowed opacity-40" : ""}`}
        >
          This Chat
        </button>
        <button
          type="button"
          onClick={() => {
            onChange("all");
            onViewAllMedia?.();
          }}
          className={`rounded-md px-2 py-1 text-xs transition ${
            value === "all"
              ? "bg-primary-gradient text-black"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          View All Media
        </button>
      </div>
    </div>
  );
}
