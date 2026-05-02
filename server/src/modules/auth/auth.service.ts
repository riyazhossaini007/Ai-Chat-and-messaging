import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { comparePassword, hashPassword } from "../../utils/hash";
import { issueJwt } from "../../utils/jwt";
import { generateOtp, sendOtpSms } from "../../utils/otp";
import { creditsService } from "../credits/credits.service";
import { rbacService } from "../security/rbac.service";
import { stepUpService } from "../security/stepup.service";

const sanitizeUser = async (user: {
  id: string;
  username: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const credits = await creditsService.getWalletSummary(user.id);
  const subscriptionActive = await creditsService.hasActiveSubscription(user.id);
  return {
    ...user,
    plan: subscriptionActive ? "PAID" : "FREE",
    subscriptionActive,
    credits,
  };
};

const generateUsername = async (name: string) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const start = base.length > 0 ? base : "user";
  let candidate = start;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${start}${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const register = async (input: {
  name: string;
  phone: string;
  password: string;
  avatar?: string | null;
}) => {
  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });

  if (existing) {
    throw new AppError(409, "Phone already registered");
  }

  const username = await generateUsername(input.name);
  const passwordHash = await hashPassword(input.password);
  const { code, expiresAt } = generateOtp();

  const user = await prisma.$transaction(async (tx) => {
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

  await sendOtpSms(input.phone, code);

  return { user: await sanitizeUser(user) };
};

const verify = async (input: { phone: string; otp: string }) => {
  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const latestOtp = await prisma.otp.findFirst({
    where: { phoneNumber: input.phone },
    orderBy: { createdAt: "desc" },
  });

  if (!latestOtp) {
    throw new AppError(400, "OTP not found");
  }

  if (latestOtp.expiresAt < new Date()) {
    throw new AppError(400, "OTP expired");
  }

  if (latestOtp.code !== input.otp) {
    await prisma.otp.update({
      where: { id: latestOtp.id },
      data: { attempt: { increment: 1 } },
    });
    throw new AppError(400, "Invalid OTP");
  }

  const updated = await prisma.$transaction(async (tx) => {
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

  const token = issueJwt(updated.id);
  return { user: await sanitizeUser(updated), token };
};

const login = async (input: { phone: string; password: string }) => {
  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user) {
    throw new AppError(401, "Invalid credentials");
  }

  const passwordOk = await comparePassword(input.password, user.passwordHash);
  if (!passwordOk) {
    throw new AppError(401, "Invalid credentials");
  }

  if (!user.isVerified) {
    throw new AppError(403, "Account not verified");
  }

  const token = issueJwt(user.id);
  return {
    user: await sanitizeUser(user),
    token,
  };
};

const logout = async () => ({ ok: true });

const startSuperadminStepUp = async (input: {
  userId: string;
  password: string;
  reason: string;
}) => {
  const isSuperAdmin = await rbacService.userHasRole(input.userId, "SUPERADMIN");
  if (!isSuperAdmin) {
    throw new AppError(403, "SUPERADMIN required");
  }
  return stepUpService.startStepUpChallenge(input);
};

const verifySuperadminStepUp = async (input: {
  userId: string;
  challengeId: string;
  otp: string;
}) => {
  const isSuperAdmin = await rbacService.userHasRole(input.userId, "SUPERADMIN");
  if (!isSuperAdmin) {
    throw new AppError(403, "SUPERADMIN required");
  }
  return stepUpService.verifyStepUpChallenge(input);
};

export const authService = {
  register,
  verify,
  login,
  logout,
  startSuperadminStepUp,
  verifySuperadminStepUp,
};
