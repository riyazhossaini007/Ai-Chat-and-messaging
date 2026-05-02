import { api } from "./api";
import type { ApiEnvelope, AuthUser, NearbyUserRecord } from "./types";

export const getMe = async () => {
  const response = await api.get<ApiEnvelope<{ user: AuthUser }>>("/users/me");
  return response.data.data.user;
};

export const patchMe = async (payload: {
  name?: string;
  avatar?: string | null;
  username?: string;
}) => {
  const response = await api.patch<ApiEnvelope<{ user: AuthUser }>>(
    "/users/me",
    payload
  );
  return response.data.data.user;
};

export const deleteMe = async () => {
  const response = await api.delete<ApiEnvelope<{ ok: boolean }>>("/users/me");
  return response.data.data.ok;
};

export const getNearbyUsers = async () => {
  const response = await api.get<ApiEnvelope<{ users: NearbyUserRecord[] }>>("/users/nearby");
  return response.data.data.users;
};
