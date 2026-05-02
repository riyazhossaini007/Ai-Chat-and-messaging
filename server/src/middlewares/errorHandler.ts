import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? (typeof (details as { code?: unknown })?.code === "string"
      ? String((details as { code?: unknown }).code)
      : undefined);
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

const SENSITIVE_KEYS = new Set([
  "message_kek_b64",
  "message_kek_id",
  "dekwrapped",
  "ciphertext",
  "iv",
  "authtag",
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
]);

const redactSensitive = (input: unknown): unknown => {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(redactSensitive);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = redactSensitive(value);
  }
  return out;
};

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  const code = err instanceof AppError ? err.code : undefined;
  const details = err instanceof AppError ? redactSensitive(err.details) : undefined;

  res.status(statusCode).json({
    success: false,
    ...(code ? { code } : {}),
    message,
    details,
  });
};
