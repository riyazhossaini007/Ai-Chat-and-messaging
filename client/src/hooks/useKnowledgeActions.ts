import { useCallback, useState } from "react";
import { extractKnowledge } from "../api/ai.api";

type SavePayload = {
  chatId?: string;
  groupId?: string;
  messageIds?: string[];
  knowledgeType?:
    | "SUMMARY"
    | "TASK"
    | "DECISION"
    | "IDEA"
    | "FACT"
    | "FOLLOW_UP"
    | "MEETING_NOTE"
    | "ISSUE"
    | "RISK"
    | "MILESTONE";
  title?: string;
  summary?: string;
};

export function useKnowledgeActions() {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearStatus = useCallback(() => {
    setNotice(null);
    setError(null);
  }, []);

  const saveToKnowledge = useCallback(async (input: SavePayload) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await extractKnowledge({
        ...input,
        saveToMemory: false,
      });
      setNotice(result.knowledgeItems.length > 1 ? "Saved to knowledge." : "Knowledge item saved.");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save to knowledge.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveToMemory = useCallback(async (input: SavePayload) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await extractKnowledge({
        ...input,
        saveToMemory: true,
      });
      setNotice(result.memoryItems.length > 0 ? "Saved to memory." : "Memory saved.");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save to memory.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    saving,
    notice,
    error,
    clearStatus,
    saveToKnowledge,
    saveToMemory,
  };
}
