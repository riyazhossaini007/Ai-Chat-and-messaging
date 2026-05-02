"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
/**
 * Sign JWT token
 */
const signToken = (userId) => {
    const secret = env_1.env.JWT_SECRET;
    const options = {
        expiresIn: env_1.env.JWT_EXPIRES_IN,
    };
    return jsonwebtoken_1.default.sign({ sub: userId }, secret, options);
};
exports.signToken = signToken;
/**
 * Verify JWT token
 */
const verifyToken = (token) => {
    const secret = env_1.env.JWT_SECRET;
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyToken = verifyToken;
