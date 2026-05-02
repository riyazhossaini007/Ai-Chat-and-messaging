import { Request } from "express";

export type AuthUser = {
  id: string;
  username: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";
  status: "ACTIVE" | "BANNED" | "DELETED";
};

export interface AuthRequest extends Request {
  user?: AuthUser;
  traceId?: string;
  rawBody?: Buffer;
}

export type SafeUser = AuthUser & {
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};
