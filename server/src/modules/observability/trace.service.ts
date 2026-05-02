import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

type TraceStore = {
  traceId: string;
  requestId?: string;
  userId?: string;
  chatId?: string;
};

const traceStorage = new AsyncLocalStorage<TraceStore>();

const createTraceId = () => crypto.randomUUID();

const runWithTrace = <T>(store: TraceStore, fn: () => T) => {
  return traceStorage.run(store, fn);
};

const getTraceContext = () => traceStorage.getStore();

const withSpan = async <T>(
  name: string,
  attrs: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> => {
  const startedAt = Date.now();
  const context = getTraceContext();
  const spanId = crypto.randomUUID();
  console.info(
    JSON.stringify({
      event: "trace.span.start",
      name,
      spanId,
      traceId: context?.traceId ?? null,
      requestId: context?.requestId ?? null,
      ...attrs,
    })
  );
  try {
    const result = await fn();
    console.info(
      JSON.stringify({
        event: "trace.span.ok",
        name,
        spanId,
        traceId: context?.traceId ?? null,
        requestId: context?.requestId ?? null,
        latencyMs: Date.now() - startedAt,
        ...attrs,
      })
    );
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "trace.span.error",
        name,
        spanId,
        traceId: context?.traceId ?? null,
        requestId: context?.requestId ?? null,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "unknown",
        ...attrs,
      })
    );
    throw error;
  }
};

export const traceService = {
  createTraceId,
  runWithTrace,
  getTraceContext,
  withSpan,
};
