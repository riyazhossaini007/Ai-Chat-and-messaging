"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const errorHandler_1 = require("./errorHandler");
const validate = (validator) => (req, _res, next) => {
    try {
        req.body = validator(req.body);
        next();
    }
    catch (error) {
        next(error instanceof errorHandler_1.AppError
            ? error
            : new errorHandler_1.AppError(400, "Validation failed"));
    }
};
exports.validate = validate;
