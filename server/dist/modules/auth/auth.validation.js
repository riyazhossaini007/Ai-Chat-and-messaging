"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLogin = exports.validateVerify = exports.validateRegister = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const validateRegister = (payload) => {
    const body = payload;
    if (!body?.name || !body?.phone || !body?.password) {
        throw new errorHandler_1.AppError(400, "name, phone and password are required");
    }
    return {
        name: body.name.trim(),
        phone: body.phone.trim(),
        password: body.password,
        avatar: body.avatar ?? null,
    };
};
exports.validateRegister = validateRegister;
const validateVerify = (payload) => {
    const body = payload;
    if (!body?.phone || !body?.otp) {
        throw new errorHandler_1.AppError(400, "phone and otp are required");
    }
    return { phone: body.phone.trim(), otp: body.otp.trim() };
};
exports.validateVerify = validateVerify;
const validateLogin = (payload) => {
    const body = payload;
    if (!body?.phone || !body?.password) {
        throw new errorHandler_1.AppError(400, "phone and password are required");
    }
    return { phone: body.phone.trim(), password: body.password };
};
exports.validateLogin = validateLogin;
