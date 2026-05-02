"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRange = exports.ensureEnum = exports.parseIntInRange = exports.parseString = exports.parseBoolean = exports.parseOptionalIsoDate = exports.parseIsoDate = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const parseIsoDate = (value, field, opts) => {
    if (value === undefined || value === null || value === "") {
        if (opts?.nullable)
            return null;
        throw new errorHandler_1.AppError(400, `${field} is required`);
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()))
        throw new errorHandler_1.AppError(400, `${field} must be a valid ISO date`);
    return date;
};
exports.parseIsoDate = parseIsoDate;
const parseOptionalIsoDate = (value, field) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    return (0, exports.parseIsoDate)(value, field);
};
exports.parseOptionalIsoDate = parseOptionalIsoDate;
const parseBoolean = (value, field) => {
    if (typeof value === "boolean")
        return value;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    throw new errorHandler_1.AppError(400, `${field} must be boolean`);
};
exports.parseBoolean = parseBoolean;
const parseString = (value, field, opts) => {
    if (value === undefined || value === null) {
        if (opts?.optional)
            return undefined;
        throw new errorHandler_1.AppError(400, `${field} is required`);
    }
    const out = String(value).trim();
    if (!out && !opts?.optional)
        throw new errorHandler_1.AppError(400, `${field} is required`);
    if (opts?.max && out.length > opts.max)
        throw new errorHandler_1.AppError(400, `${field} is too long`);
    return out;
};
exports.parseString = parseString;
const parseIntInRange = (value, field, opts) => {
    if (value === undefined || value === null || value === "") {
        if (opts?.defaultValue !== undefined)
            return opts.defaultValue;
        throw new errorHandler_1.AppError(400, `${field} is required`);
    }
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num))
        throw new errorHandler_1.AppError(400, `${field} must be an integer`);
    if (opts?.min !== undefined && num < opts.min)
        throw new errorHandler_1.AppError(400, `${field} must be >= ${opts.min}`);
    if (opts?.max !== undefined && num > opts.max)
        throw new errorHandler_1.AppError(400, `${field} must be <= ${opts.max}`);
    return num;
};
exports.parseIntInRange = parseIntInRange;
const ensureEnum = (value, field, values) => {
    const str = String(value ?? "").trim();
    if (!values.includes(str)) {
        throw new errorHandler_1.AppError(400, `${field} must be one of: ${values.join(", ")}`);
    }
    return str;
};
exports.ensureEnum = ensureEnum;
const parseRange = (query, defaultDays = 7) => {
    const to = (0, exports.parseOptionalIsoDate)(query.to, "to") ?? new Date();
    const from = (0, exports.parseOptionalIsoDate)(query.from, "from") ?? new Date(to.getTime() - defaultDays * 86400000);
    if (from > to)
        throw new errorHandler_1.AppError(400, "from must be before to");
    return { from, to };
};
exports.parseRange = parseRange;
