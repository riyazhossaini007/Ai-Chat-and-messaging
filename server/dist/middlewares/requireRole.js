"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const errorHandler_1 = require("./errorHandler");
const ROLE_WEIGHT = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPERADMIN: 4,
};
const requireRole = (...roles) => {
    const minWeight = Math.min(...roles.map((role) => ROLE_WEIGHT[role]));
    return async (req, _res, next) => {
        try {
            if (!req.user)
                throw new errorHandler_1.AppError(401, "Unauthorized");
            const role = req.user.role;
            if (!role || (ROLE_WEIGHT[role] ?? 0) < minWeight) {
                throw new errorHandler_1.AppError(403, "Forbidden", { code: "insufficient-role", roles });
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireRole = requireRole;
