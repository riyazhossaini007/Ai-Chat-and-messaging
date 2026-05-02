import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

type Props = {
  children: ReactNode;
  allow?: Array<"MODERATOR" | "ADMIN" | "SUPERADMIN">;
};

const weight = { USER: 1, MODERATOR: 2, ADMIN: 3, SUPERADMIN: 4 } as const;

export default function AdminRoute({ children, allow = ["MODERATOR", "ADMIN", "SUPERADMIN"] }: Props) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/home" replace />;
  const minAllowed = Math.min(...allow.map((role) => weight[role]));
  if ((weight[user.role] ?? 0) < minAllowed) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

