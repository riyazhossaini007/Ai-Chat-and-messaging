import { AppError } from "../../middlewares/errorHandler";

export const parseIsoDate = (value: unknown, field: string, opts?: { nullable?: boolean }) => {
  if (value === undefined || value === null || value === "") {
    if (opts?.nullable) return null;
    throw new AppError(400, `${field} is required`);
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError(400, `${field} must be a valid ISO date`);
  return date;
};

export const parseOptionalIsoDate = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  return parseIsoDate(value, field);
};

export const parseBoolean = (value: unknown, field: string) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(400, `${field} must be boolean`);
};

export const parseString = (value: unknown, field: string, opts?: { optional?: boolean; max?: number }) => {
  if (value === undefined || value === null) {
    if (opts?.optional) return undefined;
    throw new AppError(400, `${field} is required`);
  }
  const out = String(value).trim();
  if (!out && !opts?.optional) throw new AppError(400, `${field} is required`);
  if (opts?.max && out.length > opts.max) throw new AppError(400, `${field} is too long`);
  return out;
};

export const parseIntInRange = (
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number; defaultValue?: number }
) => {
  if (value === undefined || value === null || value === "") {
    if (opts?.defaultValue !== undefined) return opts.defaultValue;
    throw new AppError(400, `${field} is required`);
  }
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) throw new AppError(400, `${field} must be an integer`);
  if (opts?.min !== undefined && num < opts.min) throw new AppError(400, `${field} must be >= ${opts.min}`);
  if (opts?.max !== undefined && num > opts.max) throw new AppError(400, `${field} must be <= ${opts.max}`);
  return num;
};

export const ensureEnum = <T extends string>(value: unknown, field: string, values: readonly T[]) => {
  const str = String(value ?? "").trim() as T;
  if (!values.includes(str)) {
    throw new AppError(400, `${field} must be one of: ${values.join(", ")}`);
  }
  return str;
};

export const parseRange = (query: Record<string, unknown>, defaultDays = 7) => {
  const to = parseOptionalIsoDate(query.to, "to") ?? new Date();
  const from = parseOptionalIsoDate(query.from, "from") ?? new Date(to.getTime() - defaultDays * 86_400_000);
  if (from > to) throw new AppError(400, "from must be before to");
  return { from, to };
};

