"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireModeratorOrAdmin = void 0;
const requireRole_1 = require("./requireRole");
exports.requireModeratorOrAdmin = (0, requireRole_1.requireRole)("MODERATOR", "ADMIN");
