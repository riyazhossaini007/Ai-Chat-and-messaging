export type SearchIntent =
  | "EMPTY"
  | "AI_NAVIGATION"
  | "USER_CHAT_SEARCH"
  | "AI_CONTEXT_SEARCH"
  | "PAGE_COMMAND";

export type SearchResultType = "user" | "chat" | "page" | "ai-history" | "ai-prompt";

export type SearchResultItem = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  preview?: string;
  avatar?: string;
  online?: boolean;
  matchText: string;
  onSelect: () => void | Promise<void>;
};

export type SearchResultSection = {
  id: string;
  title: string;
  items: SearchResultItem[];
};
