import { AppError } from "../../middlewares/errorHandler";

type RegisterPayload = {
  name: string;
  phone: string;
  password: string;
  avatar?: string | null;
};

type VerifyPayload = {
  phone: string;
  otp: string;
};

type LoginPayload = {
  phone: string;
  password: string;
};

export const validateRegister = (payload: unknown): RegisterPayload => {
  const body = payload as RegisterPayload;
  if (!body?.name || !body?.phone || !body?.password) {
    throw new AppError(400, "name, phone and password are required");
  }
  return {
    name: body.name.trim(),
    phone: body.phone.trim(),
    password: body.password,
    avatar: body.avatar ?? null,
  };
};

export const validateVerify = (payload: unknown): VerifyPayload => {
  const body = payload as VerifyPayload;
  if (!body?.phone || !body?.otp) {
    throw new AppError(400, "phone and otp are required");
  }
  return { phone: body.phone.trim(), otp: body.otp.trim() };
};

export const validateLogin = (payload: unknown): LoginPayload => {
  const body = payload as LoginPayload;
  if (!body?.phone || !body?.password) {
    throw new AppError(400, "phone and password are required");
  }
  return { phone: body.phone.trim(), password: body.password };
};
