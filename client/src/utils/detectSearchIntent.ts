import type { SearchIntent } from "../type/search";

export function detectSearchIntent(query: string): SearchIntent {
  const trimmed = query.trim();
  if (!trimmed) return "EMPTY";

  const normalized = trimmed.toLowerCase();

  if (normalized === "@ai") return "AI_NAVIGATION";
  if (normalized.startsWith("@")) return "USER_CHAT_SEARCH";
  if (normalized.startsWith("/")) return "PAGE_COMMAND";

  return "AI_CONTEXT_SEARCH";
}
