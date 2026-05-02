import { useCallback, useState } from "react";
import { semanticSearch } from "../api/ai.api";
import type { SemanticSearchResultGroup } from "../api/types";

export type SemanticSearchFilters = {
  q: string;
  from?: string;
  to?: string;
  person?: string;
  chatId?: string;
  groupId?: string;
  type?: "message" | "file" | "knowledge" | "memory" | "decision" | "task";
  limit?: number;
};

export function useSemanticSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SemanticSearchResultGroup[]>([]);

  const runSearch = useCallback(async (input: SemanticSearchFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await semanticSearch(input);
      setQuery(result.query);
      setGroups(result.groups);
      return result.groups;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed.";
      setError(message);
      setGroups([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    query,
    groups,
    runSearch,
  };
}
