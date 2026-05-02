import { api } from "./api";
import type { ApiEnvelope, AuthUser } from "./types";

type LoginResponse = {
  user: AuthUser;
  token: string;
};

type RegisterResponse = {
  user: AuthUser;
};

export const registerUser = async (payload: {
  name: string;
  phone: string;
  password: string;
  avatar?: string | null;
}) => {
  const response = await api.post<ApiEnvelope<RegisterResponse>>(
    "/auth/register",
    payload
  );
  return response.data;
};

export const verifyOtp = async (payload: { phone: string; otp: string }) => {
  const response = await api.post<ApiEnvelope<LoginResponse>>(
    "/auth/verify",
    payload
  );
  return response.data;
};

export const loginUser = async (payload: { phone: string; password: string }) => {
  const response = await api.post<ApiEnvelope<LoginResponse>>(
    "/auth/login",
    payload
  );
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post<ApiEnvelope<{ ok: boolean }>>("/auth/logout");
  return response.data;
};
