import { useCallback, useEffect, useState } from "react";
import { fetchGroupDecisions, fetchGroupInsights, fetchGroupTasks } from "../api/ai.api";
import type { GroupInsightRecord, KnowledgeItemRecord } from "../api/types";

type GroupIntelligenceState = {
  loading: boolean;
  error: string | null;
  insights: GroupInsightRecord[];
  decisions: KnowledgeItemRecord[];
  tasks: KnowledgeItemRecord[];
  refresh: () => Promise<void>;
};

export function useGroupIntelligence(
  groupId: string,
  enabled: boolean,
  limit = 5
): GroupIntelligenceState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<GroupInsightRecord[]>([]);
  const [decisions, setDecisions] = useState<KnowledgeItemRecord[]>([]);
  const [tasks, setTasks] = useState<KnowledgeItemRecord[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [nextInsights, nextDecisions, nextTasks] = await Promise.all([
        fetchGroupInsights(groupId, limit),
        fetchGroupDecisions(groupId, limit),
        fetchGroupTasks(groupId, limit),
      ]);
      setInsights(nextInsights);
      setDecisions(nextDecisions);
      setTasks(nextTasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load group intelligence.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled, groupId, limit]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return {
    loading,
    error,
    insights,
    decisions,
    tasks,
    refresh,
  };
}
