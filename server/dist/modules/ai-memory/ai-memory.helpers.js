"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeKnowledgeItems = exports.getMessagePlainText = exports.assembleRankedContext = exports.buildModeInstruction = exports.getModeBudgetWeights = exports.scoreTextRelevance = exports.combineScores = exports.recencyScore = exports.filenameFromUrl = exports.chunkText = exports.estimateTokens = exports.keywordScore = exports.cosineSimilarity = exports.buildHashEmbedding = exports.simpleTags = exports.createFingerprint = exports.normalizeText = exports.slugTopic = exports.clampText = exports.MAX_SEARCH_CANDIDATES = exports.DEFAULT_CONTEXT_TOKEN_BUDGET = exports.EMBEDDING_DIMENSIONS = void 0;
const crypto_1 = require("crypto");
const messageCrypto_1 = require("../../security/messageCrypto");
exports.EMBEDDING_DIMENSIONS = 64;
exports.DEFAULT_CONTEXT_TOKEN_BUDGET = 1800;
exports.MAX_SEARCH_CANDIDATES = 200;
const clampText = (value, max = 500) => value.length > max ? `${value.slice(0, Math.max(0, max - 1)).trim()}...` : value;
exports.clampText = clampText;
const slugTopic = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
exports.slugTopic = slugTopic;
const normalizeText = (value) => value
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
exports.normalizeText = normalizeText;
const createFingerprint = (...parts) => (0, crypto_1.createHash)("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex");
exports.createFingerprint = createFingerprint;
const simpleTags = (text) => {
    const tokens = text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 4);
    return Array.from(new Set(tokens)).slice(0, 8);
};
exports.simpleTags = simpleTags;
const buildHashEmbedding = (text) => {
    const vector = new Array(exports.EMBEDDING_DIMENSIONS).fill(0);
    const normalized = (0, exports.normalizeText)(text).toLowerCase();
    if (!normalized)
        return vector;
    for (let index = 0; index < normalized.length; index += 1) {
        const code = normalized.charCodeAt(index);
        vector[index % exports.EMBEDDING_DIMENSIONS] += code / 255;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(8)));
};
exports.buildHashEmbedding = buildHashEmbedding;
const cosineSimilarity = (a, b) => {
    if (!a.length || !b.length || a.length !== b.length)
        return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let index = 0; index < a.length; index += 1) {
        dot += a[index] * b[index];
        magA += a[index] * a[index];
        magB += b[index] * b[index];
    }
    if (magA === 0 || magB === 0)
        return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};
exports.cosineSimilarity = cosineSimilarity;
const keywordScore = (query, text) => {
    const q = query.toLowerCase();
    const haystack = text.toLowerCase();
    if (!q || !haystack)
        return 0;
    if (haystack.includes(q))
        return 1;
    const tokens = q.split(/\s+/g).filter(Boolean);
    if (!tokens.length)
        return 0;
    const matches = tokens.filter((token) => haystack.includes(token)).length;
    return matches / tokens.length;
};
exports.keywordScore = keywordScore;
const estimateTokens = (text) => Math.ceil(text.length / 4);
exports.estimateTokens = estimateTokens;
const chunkText = (text, maxChars = 700, overlapChars = 120) => {
    const normalized = (0, exports.normalizeText)(text);
    if (!normalized)
        return [];
    if (normalized.length <= maxChars)
        return [normalized];
    const chunks = [];
    let start = 0;
    while (start < normalized.length) {
        const end = Math.min(normalized.length, start + maxChars);
        chunks.push(normalized.slice(start, end).trim());
        if (end >= normalized.length)
            break;
        start = Math.max(end - overlapChars, start + 1);
    }
    return chunks.filter(Boolean);
};
exports.chunkText = chunkText;
const filenameFromUrl = (value) => {
    if (!value)
        return "file";
    const clean = value.split("?")[0]?.split("#")[0] ?? value;
    const parts = clean.split(/[\\/]/g).filter(Boolean);
    return parts[parts.length - 1] || "file";
};
exports.filenameFromUrl = filenameFromUrl;
const recencyScore = (createdAt, opts) => {
    const now = opts?.now ?? new Date();
    const horizonDays = opts?.horizonDays ?? 30;
    const ageMs = Math.max(0, now.getTime() - createdAt.getTime());
    const horizonMs = horizonDays * 24 * 60 * 60 * 1000;
    const normalized = 1 - Math.min(1, ageMs / horizonMs);
    return Number(normalized.toFixed(4));
};
exports.recencyScore = recencyScore;
const combineScores = (weights) => {
    const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    const total = weights.reduce((sum, [score, weight]) => sum + score * weight, 0);
    return Number((total / totalWeight).toFixed(4));
};
exports.combineScores = combineScores;
const scoreTextRelevance = (query, text, vectorScore = 0, recency = 0) => (0, exports.combineScores)([
    [(0, exports.keywordScore)(query, text), 0.45],
    [vectorScore, 0.4],
    [recency, 0.15],
]);
exports.scoreTextRelevance = scoreTextRelevance;
const MODE_BUDGET_WEIGHTS = {
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
const getModeBudgetWeights = (mode) => MODE_BUDGET_WEIGHTS[mode];
exports.getModeBudgetWeights = getModeBudgetWeights;
const buildModeInstruction = (mode) => {
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
exports.buildModeInstruction = buildModeInstruction;
const assembleRankedContext = (input) => {
    const weights = (0, exports.getModeBudgetWeights)(input.mode);
    const budgets = Object.fromEntries(Object.entries(weights).map(([section, weight]) => [
        section,
        Math.max(90, Math.floor(input.tokenBudget * weight)),
    ]));
    const grouped = input.candidates.reduce((acc, candidate) => {
        acc[candidate.section] = [...(acc[candidate.section] ?? []), candidate];
        return acc;
    }, {
        selected_message: [],
        recent_conversation: [],
        relevant_memory: [],
        group_insights: [],
        relevant_files: [],
    });
    const selected = [];
    let usedTokens = 0;
    const usedBySection = {
        selected_message: 0,
        recent_conversation: 0,
        relevant_memory: 0,
        group_insights: 0,
        relevant_files: 0,
    };
    Object.keys(grouped).forEach((section) => {
        const budget = budgets[section];
        for (const candidate of grouped[section].sort((a, b) => b.relevanceScore - a.relevanceScore)) {
            const tokenCost = candidate.tokenCost ??
                (0, exports.estimateTokens)(`[${candidate.sourceType}] ${candidate.title}\n${candidate.snippet}`);
            if (usedBySection[section] + tokenCost > budget)
                continue;
            if (usedTokens + tokenCost > input.tokenBudget)
                continue;
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
exports.assembleRankedContext = assembleRankedContext;
const getMessagePlainText = (message, dek) => {
    if (message.deletedForEveryone)
        return null;
    if (message.cipherText && message.iv && message.authTag) {
        if (!dek)
            return null;
        try {
            return (0, messageCrypto_1.decryptText)({
                cipherTextB64: message.cipherText,
                ivB64: message.iv,
                authTagB64: message.authTag,
                algo: "A256GCM",
            }, dek);
        }
        catch {
            return null;
        }
    }
    return message.content ?? message.text ?? null;
};
exports.getMessagePlainText = getMessagePlainText;
const synthesizeKnowledgeItems = (input) => {
    const combined = (0, exports.normalizeText)(input.messages
        .map((message) => message.content ?? message.mediaUrl ?? "")
        .filter(Boolean)
        .join("\n"));
    if (!combined)
        return [];
    const title = input.title?.trim() ||
        (0, exports.clampText)(combined
            .split(/[.!?\n]/g)
            .map((item) => item.trim())
            .find(Boolean) ?? "Conversation knowledge", 80);
    const summary = input.summary?.trim() || (0, exports.clampText)(combined, 180);
    const tags = (0, exports.simpleTags)(combined);
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
    const items = [{ ...base, type: "SUMMARY" }];
    if (/(todo|follow up|action item|need to|please|next step)/i.test(lower)) {
        items.push({
            ...base,
            type: "TASK",
            title: (0, exports.clampText)(`Task: ${title}`, 80),
            shortSummary: (0, exports.clampText)(summary, 160),
            confidenceScore: 0.74,
        });
    }
    if (/(decision|decided|agreed|final|approved)/i.test(lower)) {
        items.push({
            ...base,
            type: "DECISION",
            title: (0, exports.clampText)(`Decision: ${title}`, 80),
            confidenceScore: 0.79,
        });
    }
    if (/(idea|proposal|suggest|brainstorm)/i.test(lower)) {
        items.push({
            ...base,
            type: "IDEA",
            title: (0, exports.clampText)(`Idea: ${title}`, 80),
            confidenceScore: 0.68,
        });
    }
    if (/(risk|blocker|blocked|issue|problem)/i.test(lower)) {
        items.push({
            ...base,
            type: "RISK",
            title: (0, exports.clampText)(`Risk: ${title}`, 80),
            confidenceScore: 0.72,
        });
    }
    return items;
};
exports.synthesizeKnowledgeItems = synthesizeKnowledgeItems;
