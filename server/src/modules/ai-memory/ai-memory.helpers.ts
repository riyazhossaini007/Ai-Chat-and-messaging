import { createHash } from "crypto";
import { decryptText } from "../../security/messageCrypto";

export type KnowledgeType =
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

export type ContextMode =
  | "SUMMARIZE"
  | "ANSWER_QUESTION"
  | "EXTRACT_TASKS"
  | "EXPLAIN"
  | "SEARCH_MEMORY"
  | "PROJECT_UPDATE";

export type ResponseSourceType =
  | "MESSAGE"
  | "FILE"
  | "KNOWLEDGE"
  | "MEMORY"
  | "GROUP_INSIGHT";

export type AccessibleMessage = {
  id: string;
  chatId: string;
  groupId: string | null;
  senderId: string | null;
  createdAt: Date;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  content: string | null;
  mediaUrl: string | null;
  meta: Record<string, unknown> | null;
};

export type ContextSourceCandidate = {
  sourceType: ResponseSourceType;
  sourceId: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  meta: Record<string, unknown>;
  section:
    | "selected_message"
    | "recent_conversation"
    | "relevant_memory"
    | "group_insights"
    | "relevant_files";
  tokenCost?: number;
};

export const EMBEDDING_DIMENSIONS = 64;
export const DEFAULT_CONTEXT_TOKEN_BUDGET = 1800;
export const MAX_SEARCH_CANDIDATES = 200;

export const clampText = (value: string, max = 500) =>
  value.length > max ? `${value.slice(0, Math.max(0, max - 1)).trim()}...` : value;

export const slugTopic = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();

export const createFingerprint = (...parts: Array<string | null | undefined>) =>
  createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex");

export const simpleTags = (text: string) => {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4);
  return Array.from(new Set(tokens)).slice(0, 8);
};

export const buildHashEmbedding = (text: string) => {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return vector;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    vector[index % EMBEDDING_DIMENSIONS] += code / 255;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
};

export const cosineSimilarity = (a: number[], b: number[]) => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

export const keywordScore = (query: string, text: string) => {
  const q = query.toLowerCase();
  const haystack = text.toLowerCase();
  if (!q || !haystack) return 0;
  if (haystack.includes(q)) return 1;
  const tokens = q.split(/\s+/g).filter(Boolean);
  if (!tokens.length) return 0;
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches / tokens.length;
};

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export const chunkText = (text: string, maxChars = 700, overlapChars = 120) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + maxChars);
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks.filter(Boolean);
};

export const filenameFromUrl = (value: string | null | undefined) => {
  if (!value) return "file";
  const clean = value.split("?")[0]?.split("#")[0] ?? value;
  const parts = clean.split(/[\\/]/g).filter(Boolean);
  return parts[parts.length - 1] || "file";
};

export const recencyScore = (
  createdAt: Date,
  opts?: { now?: Date; horizonDays?: number }
) => {
  const now = opts?.now ?? new Date();
  const horizonDays = opts?.horizonDays ?? 30;
  const ageMs = Math.max(0, now.getTime() - createdAt.getTime());
  const horizonMs = horizonDays * 24 * 60 * 60 * 1000;
  const normalized = 1 - Math.min(1, ageMs / horizonMs);
  return Number(normalized.toFixed(4));
};

export const combineScores = (weights: Array<[score: number, weight: number]>) => {
  const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const total = weights.reduce((sum, [score, weight]) => sum + score * weight, 0);
  return Number((total / totalWeight).toFixed(4));
};

export const scoreTextRelevance = (query: string, text: string, vectorScore = 0, recency = 0) =>
  combineScores([
    [keywordScore(query, text), 0.45],
    [vectorScore, 0.4],
    [recency, 0.15],
  ]);

const MODE_BUDGET_WEIGHTS: Record<
  ContextMode,
  Record<ContextSourceCandidate["section"], number>
> = {
  SUMMARIZE: {
    selected_message: 0.3,
    recent_conversation: 0.28,
    relevant_memory: 0.16,
    group_insights: 0.12,
    relevant_files: 0.14,
  },
  ANSWER_QUESTION: {
    selected_message: 0.26,
    recent_conversation: 0.24,
    relevant_memory: 0.22,
    group_insights: 0.12,
    relevant_files: 0.16,
  },
  EXTRACT_TASKS: {
    selected_message: 0.18,
    recent_conversation: 0.34,
    relevant_memory: 0.14,
    group_insights: 0.12,
    relevant_files: 0.22,
  },
  EXPLAIN: {
    selected_message: 0.28,
    recent_conversation: 0.2,
    relevant_memory: 0.18,
    group_insights: 0.1,
    relevant_files: 0.24,
  },
  SEARCH_MEMORY: {
    selected_message: 0.08,
    recent_conversation: 0.14,
    relevant_memory: 0.46,
    group_insights: 0.08,
    relevant_files: 0.24,
  },
  PROJECT_UPDATE: {
    selected_message: 0.12,
    recent_conversation: 0.26,
    relevant_memory: 0.16,
    group_insights: 0.28,
    relevant_files: 0.18,
  },
};

export const getModeBudgetWeights = (mode: ContextMode) => MODE_BUDGET_WEIGHTS[mode];

export const buildModeInstruction = (mode: ContextMode) => {
  if (mode === "SUMMARIZE") {
    return "Summarize the selected discussion faithfully. Prioritize what was said, what changed, and any explicit outcomes.";
  }
  if (mode === "EXPLAIN") {
    return "Explain the topic clearly using only supplied context. Distinguish direct evidence from reasonable inference.";
  }
  if (mode === "EXTRACT_TASKS") {
    return "Extract only explicit or strongly implied action items. Include owner and due date only when supported by context.";
  }
  if (mode === "SEARCH_MEMORY") {
    return "Answer the memory query by surfacing the most relevant historical context, organized chronologically when useful.";
  }
  if (mode === "PROJECT_UPDATE") {
    return "Produce a project update focused on decisions, progress, blockers, and recent changes.";
  }
  return "Answer the user question using only the supplied context and keep every claim grounded in sources.";
};

export const assembleRankedContext = (input: {
  mode: ContextMode;
  tokenBudget: number;
  candidates: ContextSourceCandidate[];
}) => {
  const weights = getModeBudgetWeights(input.mode);
  const budgets = Object.fromEntries(
    Object.entries(weights).map(([section, weight]) => [
      section,
      Math.max(90, Math.floor(input.tokenBudget * weight)),
    ])
  ) as Record<ContextSourceCandidate["section"], number>;

  const grouped = input.candidates.reduce<Record<ContextSourceCandidate["section"], ContextSourceCandidate[]>>(
    (acc, candidate) => {
      acc[candidate.section] = [...(acc[candidate.section] ?? []), candidate];
      return acc;
    },
    {
      selected_message: [],
      recent_conversation: [],
      relevant_memory: [],
      group_insights: [],
      relevant_files: [],
    }
  );

  const selected: ContextSourceCandidate[] = [];
  let usedTokens = 0;
  const usedBySection: Record<ContextSourceCandidate["section"], number> = {
    selected_message: 0,
    recent_conversation: 0,
    relevant_memory: 0,
    group_insights: 0,
    relevant_files: 0,
  };

  (Object.keys(grouped) as Array<ContextSourceCandidate["section"]>).forEach((section) => {
    const budget = budgets[section];
    for (const candidate of grouped[section].sort((a, b) => b.relevanceScore - a.relevanceScore)) {
      const tokenCost =
        candidate.tokenCost ??
        estimateTokens(`[${candidate.sourceType}] ${candidate.title}\n${candidate.snippet}`);
      if (usedBySection[section] + tokenCost > budget) continue;
      if (usedTokens + tokenCost > input.tokenBudget) continue;
      selected.push({ ...candidate, tokenCost });
      usedBySection[section] += tokenCost;
      usedTokens += tokenCost;
    }
  });

  const promptContext = [
    selected
      .filter((candidate) => candidate.section === "selected_message")
      .map((candidate) => `[Selected Message] ${candidate.title}\n${candidate.snippet}`)
      .join("\n\n"),
    selected
      .filter((candidate) => candidate.section === "recent_conversation")
      .map((candidate) => `[Recent Conversation] ${candidate.title}\n${candidate.snippet}`)
      .join("\n\n"),
    selected
      .filter((candidate) => candidate.section === "relevant_memory")
      .map((candidate) => `[Relevant Memory] ${candidate.title}\n${candidate.snippet}`)
      .join("\n\n"),
    selected
      .filter((candidate) => candidate.section === "group_insights")
      .map((candidate) => `[Group Insight] ${candidate.title}\n${candidate.snippet}`)
      .join("\n\n"),
    selected
      .filter((candidate) => candidate.section === "relevant_files")
      .map((candidate) => `[Relevant File Chunk] ${candidate.title}\n${candidate.snippet}`)
      .join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    promptContext,
    selectedSources: selected,
    usedTokens,
    budgets,
    usedBySection,
  };
};

export const getMessagePlainText = (
  message: {
    content?: string | null;
    text?: string | null;
    cipherText?: string | null;
    iv?: string | null;
    authTag?: string | null;
    deletedForEveryone?: boolean;
  },
  dek: Buffer | null
) => {
  if (message.deletedForEveryone) return null;
  if (message.cipherText && message.iv && message.authTag) {
    if (!dek) return null;
    try {
      return decryptText(
        {
          cipherTextB64: message.cipherText,
          ivB64: message.iv,
          authTagB64: message.authTag,
          algo: "A256GCM",
        },
        dek
      );
    } catch {
      return null;
    }
  }
  return message.content ?? message.text ?? null;
};

export const synthesizeKnowledgeItems = (input: {
  messages: AccessibleMessage[];
  requestedType?: KnowledgeType;
  title?: string;
  summary?: string;
}) => {
  const combined = normalizeText(
    input.messages
      .map((message) => message.content ?? message.mediaUrl ?? "")
      .filter(Boolean)
      .join("\n")
  );
  if (!combined) return [];

  const title =
    input.title?.trim() ||
    clampText(
      combined
        .split(/[.!?\n]/g)
        .map((item) => item.trim())
        .find(Boolean) ?? "Conversation knowledge",
      80
    );
  const summary = input.summary?.trim() || clampText(combined, 180);
  const tags = simpleTags(combined);
  const base = {
    title,
    shortSummary: summary,
    normalizedContent: combined,
    tags,
    confidenceScore: 0.62,
  };

  if (input.requestedType) {
    return [{ ...base, type: input.requestedType }];
  }

  const lower = combined.toLowerCase();
  const items: Array<typeof base & { type: KnowledgeType }> = [{ ...base, type: "SUMMARY" }];

  if (/(todo|follow up|action item|need to|please|next step)/i.test(lower)) {
    items.push({
      ...base,
      type: "TASK",
      title: clampText(`Task: ${title}`, 80),
      shortSummary: clampText(summary, 160),
      confidenceScore: 0.74,
    });
  }
  if (/(decision|decided|agreed|final|approved)/i.test(lower)) {
    items.push({
      ...base,
      type: "DECISION",
      title: clampText(`Decision: ${title}`, 80),
      confidenceScore: 0.79,
    });
  }
  if (/(idea|proposal|suggest|brainstorm)/i.test(lower)) {
    items.push({
      ...base,
      type: "IDEA",
      title: clampText(`Idea: ${title}`, 80),
      confidenceScore: 0.68,
    });
  }
  if (/(risk|blocker|blocked|issue|problem)/i.test(lower)) {
    items.push({
      ...base,
      type: "RISK",
      title: clampText(`Risk: ${title}`, 80),
      confidenceScore: 0.72,
    });
  }

  return items;
};
