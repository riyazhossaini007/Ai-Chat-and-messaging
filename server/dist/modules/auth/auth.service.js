"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const hash_1 = require("../../utils/hash");
const jwt_1 = require("../../utils/jwt");
const otp_1 = require("../../utils/otp");
const credits_service_1 = require("../credits/credits.service");
const rbac_service_1 = require("../security/rbac.service");
const stepup_service_1 = require("../security/stepup.service");
const sanitizeUser = async (user) => {
    const credits = await credits_service_1.creditsService.getWalletSummary(user.id);
    const subscriptionActive = await credits_service_1.creditsService.hasActiveSubscription(user.id);
    return {
        ...user,
        plan: subscriptionActive ? "PAID" : "FREE",
        subscriptionActive,
        credits,
    };
};
const generateUsername = async (name) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const start = base.length > 0 ? base : "user";
    let candidate = start;
    let suffix = 1;
    while (await prisma_1.prisma.user.findUnique({ where: { username: candidate } })) {
        candidate = `${start}${suffix}`;
        suffix += 1;
    }
    return candidate;
};
const register = async (input) => {
    const existing = await prisma_1.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
        throw new errorHandler_1.AppError(409, "Phone already registered");
    }
    const username = await generateUsername(input.name);
    const passwordHash = await (0, hash_1.hashPassword)(input.password);
    const { code, expiresAt } = (0, otp_1.generateOtp)();
    const user = await prisma_1.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
            data: {
                username,
                name: input.name,
                phone: input.phone,
                avatar: input.avatar ?? null,
                passwordHash,
            },
            select: {
                id: true,
                username: true,
                name: true,
                phone: true,
                avatar: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        await tx.userSettings.create({
            data: { userId: createdUser.id },
        });
        await tx.otp.create({
            data: {
                phoneNumber: input.phone,
                code,
                expiresAt,
            },
        });
        return createdUser;
    });
    await (0, otp_1.sendOtpSms)(input.phone, code);
    return { user: await sanitizeUser(user) };
};
const verify = async (input) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) {
        throw new errorHandler_1.AppError(404, "User not found");
    }
    const latestOtp = await prisma_1.prisma.otp.findFirst({
        where: { phoneNumber: input.phone },
        orderBy: { createdAt: "desc" },
    });
    if (!latestOtp) {
        throw new errorHandler_1.AppError(400, "OTP not found");
    }
    if (latestOtp.expiresAt < new Date()) {
        throw new errorHandler_1.AppError(400, "OTP expired");
    }
    if (latestOtp.code !== input.otp) {
        await prisma_1.prisma.otp.update({
            where: { id: latestOtp.id },
            data: { attempt: { increment: 1 } },
        });
        throw new errorHandler_1.AppError(400, "Invalid OTP");
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const verifiedUser = await tx.user.update({
            where: { id: user.id },
            data: { isVerified: true },
            select: {
                id: true,
                username: true,
                name: true,
                phone: true,
                avatar: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        await tx.otp.deleteMany({ where: { phoneNumber: input.phone } });
        return verifiedUser;
    });
    const token = (0, jwt_1.issueJwt)(updated.id);
    return { user: await sanitizeUser(updated), token };
};
const login = async (input) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) {
        throw new errorHandler_1.AppError(401, "Invalid credentials");
    }
    const passwordOk = await (0, hash_1.comparePassword)(input.password, user.passwordHash);
    if (!passwordOk) {
        throw new errorHandler_1.AppError(401, "Invalid credentials");
    }
    if (!user.isVerified) {
        throw new errorHandler_1.AppError(403, "Account not verified");
    }
    const token = (0, jwt_1.issueJwt)(user.id);
    return {
        user: await sanitizeUser(user),
        token,
    };
};
const logout = async () => ({ ok: true });
const startSuperadminStepUp = async (input) => {
    const isSuperAdmin = await rbac_service_1.rbacService.userHasRole(input.userId, "SUPERADMIN");
    if (!isSuperAdmin) {
        throw new errorHandler_1.AppError(403, "SUPERADMIN required");
    }
    return stepup_service_1.stepUpService.startStepUpChallenge(input);
};
const verifySuperadminStepUp = async (input) => {
    const isSuperAdmin = await rbac_service_1.rbacService.userHasRole(input.userId, "SUPERADMIN");
    if (!isSuperAdmin) {
        throw new errorHandler_1.AppError(403, "SUPERADMIN required");
    }
    return stepup_service_1.stepUpService.verifyStepUpChallenge(input);
};
exports.authService = {
    register,
    verify,
    login,
    logout,
    startSuperadminStepUp,
    verifySuperadminStepUp,
};
