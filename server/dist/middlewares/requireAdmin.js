"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const requireRole_1 = require("./requireRole");
exports.requireAdmin = (0, requireRole_1.requireRole)("ADMIN");
