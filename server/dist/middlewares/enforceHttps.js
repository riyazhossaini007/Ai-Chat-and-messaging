"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceHttps = void 0;
const env_1 = require("../config/env");
const HTTPS_METHODS = new Set(["GET", "HEAD"]);
const isHttps = (req) => {
    if (req.secure)
        return true;
    const forwardedProto = req.headers["x-forwarded-proto"];
    if (typeof forwardedProto === "string") {
        return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
    }
    return false;
};
const enforceHttps = (req, res, next) => {
    if (!env_1.env.ENFORCE_HTTPS)
        return next();
    if (isHttps(req))
        return next();
    const host = req.headers.host;
    if (!host) {
        return res.status(400).json({ error: "Missing Host header" });
    }
    const targetUrl = `https://${host}${req.originalUrl}`;
    const status = HTTPS_METHODS.has(req.method.toUpperCase()) ? env_1.env.HTTPS_REDIRECT_CODE : 400;
    if (status >= 300 && status < 400) {
        return res.redirect(status, targetUrl);
    }
    return res.status(status).json({
        error: "HTTPS_REQUIRED",
        message: "Use HTTPS for this endpoint",
    });
};
exports.enforceHttps = enforceHttps;
