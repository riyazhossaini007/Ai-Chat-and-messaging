import crypto from "node:crypto";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { comparePassword } from "../../utils/hash";
import { generateOtp, sendOtpSms } from "../../utils/otp";

const hashOtp = (otp: string) =>
  crypto
    .createHash("sha256")
    .update(`${env.AUDIT_SIGNING_SECRET}|${otp}`)
    .digest("hex");

const hashStepUpToken = (token: string) =>
  crypto
    .createHash("sha256")
    .update(`${env.AUDIT_SIGNING_SECRET}|${token}`)
    .digest("hex");

const startStepUpChallenge = async (input: {
  userId: string;
  password: string;
  reason: string;
}) => {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, phone: true, passwordHash: true },
  });
  if (!user) throw new AppError(401, "Unauthorized");
  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid password");

  const { code, expiresAt } = generateOtp();
  const challenge = await (prisma as any).adminStepUpChallenge.create({
    data: {
      userId: input.userId,
      reason: input.reason,
      otpHash: hashOtp(code),
      expiresAt,
    },
  });
  await sendOtpSms(user.phone, code);
  return {
    challengeId: challenge.id as string,
    expiresAt: challenge.expiresAt as Date,
  };
};

const verifyStepUpChallenge = async (input: {
  userId: string;
  challengeId: string;
  otp: string;
}) => {
  const challenge = await (prisma as any).adminStepUpChallenge.findUnique({
    where: { id: input.challengeId },
  });
  if (!challenge || challenge.userId !== input.userId) {
    throw new AppError(404, "Step-up challenge not found");
  }
  if (challenge.usedAt) throw new AppError(400, "Step-up challenge already used");
  if (challenge.expiresAt < new Date()) throw new AppError(400, "Step-up challenge expired");
  if ((challenge.attempts as number) >= 5) throw new AppError(429, "Too many invalid OTP attempts");

  if (challenge.otpHash !== hashOtp(input.otp)) {
    await (prisma as any).adminStepUpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(400, "Invalid OTP");
  }

  const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomBytes(16).toString("hex");
  const sessionExpiresAt = new Date(Date.now() + Math.max(60_000, env.ADMIN_STEPUP_TTL_MS));

  await (prisma as any).adminStepUpChallenge.update({
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

const validateStepUpToken = async (input: { userId: string; token: string }) => {
  if (!env.ADMIN_STEPUP_REQUIRED) return { valid: true as const };
  const tokenHash = hashStepUpToken(input.token);
  const now = new Date();
  const challenge = await (prisma as any).adminStepUpChallenge.findFirst({
    where: {
      userId: input.userId,
      sessionTokenHash: tokenHash,
      sessionExpiresAt: { gt: now },
      verifiedAt: { not: null },
      usedAt: null,
    },
    orderBy: { verifiedAt: "desc" },
  });
  if (!challenge) return { valid: false as const };
  return { valid: true as const, challengeId: challenge.id as string };
};

export const stepUpService = {
  startStepUpChallenge,
  verifyStepUpChallenge,
  validateStepUpToken,
};
