import axios from "axios";
import { getAuthToken } from "../lib/authStorage";

const DEFAULT_API_URL = "http://localhost:5000";

export const getApiBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL;
  return raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_API_URL;
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
      error?: string;
      code?: string;
    };
  };
  message?: string;
};

export const getApiErrorMessage = (error: unknown) => {
  const typed = error as ApiErrorShape;
  return (
    typed?.response?.data?.message ||
    typed?.response?.data?.error ||
    typed?.message ||
    "Something went wrong"
  );
};

export const getApiErrorCode = (error: unknown) => {
  const typed = error as ApiErrorShape;
  return typed?.response?.data?.code ?? null;
};
