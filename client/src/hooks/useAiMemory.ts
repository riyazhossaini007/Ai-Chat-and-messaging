import { useCallback, useState } from "react";
import { forgetMemory, pinMemory, searchMemory } from "../api/ai.api";
import type { UserMemoryRecord } from "../api/types";

type MemorySearchInput = {
  q?: string;
  pinned?: boolean;
  recent?: boolean;
  topic?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export function useAiMemory() {
  const [items, setItems] = useState<UserMemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: MemorySearchInput) => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await searchMemory(params);
      setItems(nextItems);
      return nextItems;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load memory.";
      setError(message);
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const togglePin = useCallback(async (memoryId: string) => {
    const updated = await pinMemory(memoryId);
    setItems((current) =>
      current.map((item) => (item.id === memoryId ? { ...item, pinnedAt: updated.pinnedAt } : item))
    );
    return updated;
  }, []);

  const forget = useCallback(async (memoryId: string) => {
    await forgetMemory({ memoryId });
    setItems((current) => current.filter((item) => item.id !== memoryId));
  }, []);

  return {
    items,
    loading,
    error,
    search,
    togglePin,
    forget,
    setItems,
  };
}
