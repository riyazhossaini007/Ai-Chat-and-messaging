import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Compass, Mic, MicOff, Search } from "lucide-react";
import { useAnimatedPlaceholder } from "../../hooks/useAnimatedPlaceholder";
import type { SearchResultItem, SearchResultSection } from "../../type/search";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  sections: SearchResultSection[];
  showResults: boolean;
  emptyMessage: string | null;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectResult: (result: SearchResultItem) => void | Promise<void>;
  isListening: boolean;
  voiceError: string | null;
  onStartVoice: () => void;
  onStopVoice: () => void;
}

const highlightMatch = (text: string, keyword: string) => {
  const source = text ?? "";
  const match = keyword.trim();
  if (!match) return source;

  const textLower = source.toLowerCase();
  const keywordLower = match.toLowerCase();
  const index = textLower.indexOf(keywordLower);
  if (index < 0) return source;

  const start = source.slice(0, index);
  const middle = source.slice(index, index + match.length);
  const end = source.slice(index + match.length);

  return (
    <>
      {start}
      <mark className="rounded bg-indigo-500/20 px-0.5 text-indigo-200">{middle}</mark>
      {end}
    </>
  );
};

export const UniversalSearchInput = ({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  sections,
  showResults,
  emptyMessage,
  activeIndex,
  onActiveIndexChange,
  onSelectResult,
  isListening,
  voiceError,
  onStartVoice,
  onStopVoice,
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = useAnimatedPlaceholder([
    "Say or type 'open AI page' to navigate...",
    "Type @username or @group to find conversations...",
    "Type /settings or /dashboard for quick navigation...",
    "Type any keyword to search AI context...",
  ]);

  const handleInput = (nextValue: string) => {
    onChange(nextValue);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  let currentResultIndex = -1;

  return (
    <div className="relative w-full">
      <div
        className="
          group mx-auto w-full
          flex items-center gap-2
          rounded-xl px-3 py-2
          bg-bg-surface
          border border-border-subtle
          transition-all duration-200
          focus-within:border-primary-indigo
          focus-within:shadow-glow-sm
        "
      >
        <span
          className="relative top-px flex items-center justify-center rounded-lg bg-primary-gradient p-1.5 text-white shadow-glow-sm"
          aria-hidden="true"
        >
          <Compass size={18} className="animate-[spin_3s_linear_infinite]" />
        </span>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="
            flex-1 resize-none overflow-y-hidden bg-transparent
            outline-none max-h-40
            text-text-primary placeholder-text-muted
            sm:text-sm max-sm:text-[13px]
          "
        />

        <button
          type="button"
          onClick={isListening ? onStopVoice : onStartVoice}
          className={`
            flex items-center justify-center
            rounded-lg p-1.5
            transition
            ${
              isListening
                ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                : "text-text-muted hover:text-white hover:bg-primary-gradient"
            }
          `}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          title={isListening ? "Stop voice input" : "Start voice input"}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          type="button"
          onClick={onSubmit}
          className="
            flex items-center justify-center
            rounded-lg p-1.5
            text-text-muted
            hover:text-white
            hover:bg-primary-gradient
            transition
          "
        >
          <Search size={18} />
        </button>
      </div>

      {isListening ? (
        <div className="mt-1 px-1 text-xs text-emerald-300">Listening... say "open groups page"</div>
      ) : voiceError ? (
        <div className="mt-1 px-1 text-xs text-rose-300">{voiceError}</div>
      ) : null}

      {showResults ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xl">
          {emptyMessage ? (
            <div className="px-4 py-3 text-sm text-text-muted">{emptyMessage}</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto py-2">
              {sections.map((section) => (
                <div key={section.id} className="px-1">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {section.title}
                  </div>
                  {section.items.map((item) => {
                    currentResultIndex += 1;
                    const isActive = currentResultIndex === activeIndex;
                    const itemIndex = currentResultIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => onActiveIndexChange(itemIndex)}
                        onClick={() => {
                          void onSelectResult(item);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left transition ${
                          isActive ? "bg-bg-elevated" : "hover:bg-bg-elevated/70"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-elevated">
                            {item.avatar ? (
                              <img src={item.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                                {item.title.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {typeof item.online === "boolean" ? (
                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-bg-surface ${
                                  item.online ? "bg-emerald-400" : "bg-zinc-500"
                                }`}
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-text-primary">
                              {highlightMatch(item.title, item.matchText)}
                            </div>
                            {item.subtitle ? (
                              <div className="truncate text-xs text-text-muted">
                                {highlightMatch(item.subtitle, item.matchText)}
                              </div>
                            ) : null}
                            {item.preview ? (
                              <div className="truncate text-xs text-zinc-400">
                                {highlightMatch(item.preview, item.matchText)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
