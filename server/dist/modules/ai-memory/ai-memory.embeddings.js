"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeEmbedding = exports.embedText = void 0;
const env_1 = require("../../config/env");
const prisma_1 = require("../../config/prisma");
const ai_memory_helpers_1 = require("./ai-memory.helpers");
const prismaAny = prisma_1.prisma;
const embedText = async (text) => {
    const normalized = (0, ai_memory_helpers_1.normalizeText)(text);
    if (!normalized)
        return (0, ai_memory_helpers_1.buildHashEmbedding)("");
    if (!env_1.env.OPENAI_API_KEY) {
        return (0, ai_memory_helpers_1.buildHashEmbedding)(normalized);
    }
    try {
        const response = await fetch(`${env_1.env.OPENAI_BASE_URL}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                input: normalized,
                model: "text-embedding-3-small",
            }),
        });
        if (!response.ok) {
            return (0, ai_memory_helpers_1.buildHashEmbedding)(normalized);
        }
        const payload = (await response.json());
        const vector = payload.data?.[0]?.embedding;
        if (!Array.isArray(vector) || vector.length === 0) {
            return (0, ai_memory_helpers_1.buildHashEmbedding)(normalized);
        }
        return vector;
    }
    catch {
        return (0, ai_memory_helpers_1.buildHashEmbedding)(normalized);
    }
};
exports.embedText = embedText;
const storeEmbedding = async (input) => {
    const normalized = (0, ai_memory_helpers_1.normalizeText)(input.textContent);
    if (!normalized)
        return null;
    const vector = await (0, exports.embedText)(normalized);
    return prismaAny.embeddingRecord.upsert({
        where: {
            ownerType_ownerId_chunkIndex: {
                ownerType: input.ownerType,
                ownerId: input.ownerId,
                chunkIndex: input.chunkIndex ?? 0,
            },
        },
        create: {
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            chunkIndex: input.chunkIndex ?? 0,
            contentHash: (0, ai_memory_helpers_1.createFingerprint)(normalized),
            textContent: normalized,
            provider: input.provider ?? (env_1.env.OPENAI_API_KEY ? "openai" : "local-hash"),
            model: input.model ?? (env_1.env.OPENAI_API_KEY ? "text-embedding-3-small" : "hash64"),
            dimensions: vector.length || ai_memory_helpers_1.EMBEDDING_DIMENSIONS,
            vector,
            meta: input.meta ?? undefined,
        },
        update: {
            contentHash: (0, ai_memory_helpers_1.createFingerprint)(normalized),
            textContent: normalized,
            provider: input.provider ?? (env_1.env.OPENAI_API_KEY ? "openai" : "local-hash"),
            model: input.model ?? (env_1.env.OPENAI_API_KEY ? "text-embedding-3-small" : "hash64"),
            dimensions: vector.length || ai_memory_helpers_1.EMBEDDING_DIMENSIONS,
            vector,
            meta: input.meta ?? undefined,
        },
    });
};
exports.storeEmbedding = storeEmbedding;
