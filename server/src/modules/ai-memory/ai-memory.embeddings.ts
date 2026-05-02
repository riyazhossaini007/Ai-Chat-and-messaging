import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import {
  EMBEDDING_DIMENSIONS,
  buildHashEmbedding,
  createFingerprint,
  normalizeText,
} from "./ai-memory.helpers";

const prismaAny = prisma as any;

export const embedText = async (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return buildHashEmbedding("");
  if (!env.OPENAI_API_KEY) {
    return buildHashEmbedding(normalized);
  }

  try {
    const response = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: normalized,
        model: "text-embedding-3-small",
      }),
    });
    if (!response.ok) {
      return buildHashEmbedding(normalized);
    }
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = payload.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      return buildHashEmbedding(normalized);
    }
    return vector;
  } catch {
    return buildHashEmbedding(normalized);
  }
};

export const storeEmbedding = async (input: {
  ownerType: "MESSAGE" | "FILE" | "KNOWLEDGE" | "MEMORY" | "GROUP_INSIGHT";
  ownerId: string;
  textContent: string;
  chunkIndex?: number;
  provider?: string;
  model?: string;
  meta?: Record<string, unknown>;
}) => {
  const normalized = normalizeText(input.textContent);
  if (!normalized) return null;
  const vector = await embedText(normalized);
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
      contentHash: createFingerprint(normalized),
      textContent: normalized,
      provider: input.provider ?? (env.OPENAI_API_KEY ? "openai" : "local-hash"),
      model: input.model ?? (env.OPENAI_API_KEY ? "text-embedding-3-small" : "hash64"),
      dimensions: vector.length || EMBEDDING_DIMENSIONS,
      vector,
      meta: input.meta ?? undefined,
    },
    update: {
      contentHash: createFingerprint(normalized),
      textContent: normalized,
      provider: input.provider ?? (env.OPENAI_API_KEY ? "openai" : "local-hash"),
      model: input.model ?? (env.OPENAI_API_KEY ? "text-embedding-3-small" : "hash64"),
      dimensions: vector.length || EMBEDDING_DIMENSIONS,
      vector,
      meta: input.meta ?? undefined,
    },
  });
};
