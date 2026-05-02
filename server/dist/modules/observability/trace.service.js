"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceService = void 0;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = __importDefault(require("node:crypto"));
const traceStorage = new node_async_hooks_1.AsyncLocalStorage();
const createTraceId = () => node_crypto_1.default.randomUUID();
const runWithTrace = (store, fn) => {
    return traceStorage.run(store, fn);
};
const getTraceContext = () => traceStorage.getStore();
const withSpan = async (name, attrs, fn) => {
    const startedAt = Date.now();
    const context = getTraceContext();
    const spanId = node_crypto_1.default.randomUUID();
    console.info(JSON.stringify({
        event: "trace.span.start",
        name,
        spanId,
        traceId: context?.traceId ?? null,
        requestId: context?.requestId ?? null,
        ...attrs,
    }));
    try {
        const result = await fn();
        console.info(JSON.stringify({
            event: "trace.span.ok",
            name,
            spanId,
            traceId: context?.traceId ?? null,
            requestId: context?.requestId ?? null,
            latencyMs: Date.now() - startedAt,
            ...attrs,
        }));
        return result;
    }
    catch (error) {
        console.error(JSON.stringify({
            event: "trace.span.error",
            name,
            spanId,
            traceId: context?.traceId ?? null,
            requestId: context?.requestId ?? null,
            latencyMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "unknown",
            ...attrs,
        }));
        throw error;
    }
};
exports.traceService = {
    createTraceId,
    runWithTrace,
    getTraceContext,
    withSpan,
};
