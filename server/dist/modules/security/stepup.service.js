"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stepUpService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middlewares/errorHandler");
const hash_1 = require("../../utils/hash");
const otp_1 = require("../../utils/otp");
const hashOtp = (otp) => node_crypto_1.default
    .createHash("sha256")
    .update(`${env_1.env.AUDIT_SIGNING_SECRET}|${otp}`)
    .digest("hex");
const hashStepUpToken = (token) => node_crypto_1.default
    .createHash("sha256")
    .update(`${env_1.env.AUDIT_SIGNING_SECRET}|${token}`)
    .digest("hex");
const startStepUpChallenge = async (input) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, phone: true, passwordHash: true },
    });
    if (!user)
        throw new errorHandler_1.AppError(401, "Unauthorized");
    const valid = await (0, hash_1.comparePassword)(input.password, user.passwordHash);
    if (!valid)
        throw new errorHandler_1.AppError(401, "Invalid password");
    const { code, expiresAt } = (0, otp_1.generateOtp)();
    const challenge = await prisma_1.prisma.adminStepUpChallenge.create({
        data: {
            userId: input.userId,
            reason: input.reason,
            otpHash: hashOtp(code),
            expiresAt,
        },
    });
    await (0, otp_1.sendOtpSms)(user.phone, code);
    return {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
    };
};
const verifyStepUpChallenge = async (input) => {
    const challenge = await prisma_1.prisma.adminStepUpChallenge.findUnique({
        where: { id: input.challengeId },
    });
    if (!challenge || challenge.userId !== input.userId) {
        throw new errorHandler_1.AppError(404, "Step-up challenge not found");
    }
    if (challenge.usedAt)
        throw new errorHandler_1.AppError(400, "Step-up challenge already used");
    if (challenge.expiresAt < new Date())
        throw new errorHandler_1.AppError(400, "Step-up challenge expired");
    if (challenge.attempts >= 5)
        throw new errorHandler_1.AppError(429, "Too many invalid OTP attempts");
    if (challenge.otpHash !== hashOtp(input.otp)) {
        await prisma_1.prisma.adminStepUpChallenge.update({
            where: { id: challenge.id },
            data: { attempts: { increment: 1 } },
        });
        throw new errorHandler_1.AppError(400, "Invalid OTP");
    }
    const sessionToken = node_crypto_1.default.randomUUID().replace(/-/g, "") + node_crypto_1.default.randomBytes(16).toString("hex");
    const sessionExpiresAt = new Date(Date.now() + Math.max(60000, env_1.env.ADMIN_STEPUP_TTL_MS));
    await prisma_1.prisma.adminStepUpChallenge.update({
        where: { id: challenge.id },
        data: {
            verifiedAt: new Date(),
            sessionTokenHash: hashStepUpToken(sessionToken),
            sessionExpiresAt,
        },
    });
    return {
        stepUpToken: sessionToken,
        expiresAt: sessionExpiresAt,
    };
};
const validateStepUpToken = async (input) => {
    if (!env_1.env.ADMIN_STEPUP_REQUIRED)
        return { valid: true };
    const tokenHash = hashStepUpToken(input.token);
    const now = new Date();
    const challenge = await prisma_1.prisma.adminStepUpChallenge.findFirst({
        where: {
            userId: input.userId,
            sessionTokenHash: tokenHash,
            sessionExpiresAt: { gt: now },
            verifiedAt: { not: null },
            usedAt: null,
        },
        orderBy: { verifiedAt: "desc" },
    });
    if (!challenge)
        return { valid: false };
    return { valid: true, challengeId: challenge.id };
};
exports.stepUpService = {
    startStepUpChallenge,
    verifyStepUpChallenge,
    validateStepUpToken,
};
