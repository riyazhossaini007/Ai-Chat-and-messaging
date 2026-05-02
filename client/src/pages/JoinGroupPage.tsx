import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { joinGroupByToken } from "../api/group.api";
import { useAuthStore } from "../stores/authStore";

export default function JoinGroupPage() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const authToken = useAuthStore((store) => store.token);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void joinGroupByToken(token)
      .then((result) => {
        navigate(`/groups/${result.groupId}`, { replace: true });
      })
      .catch((e) => {
        setError(e?.response?.data?.message ?? "Unable to join group");
      });
  }, [navigate, token]);

  if (!authToken) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen items-center justify-center bg-bg-main text-text-primary">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
        <div className="text-lg font-semibold">{error ? "Join failed" : "Joining group..."}</div>
        {error && <p className="mt-2 text-sm text-zinc-400">{error}</p>}
      </div>
    </div>
  );
}
