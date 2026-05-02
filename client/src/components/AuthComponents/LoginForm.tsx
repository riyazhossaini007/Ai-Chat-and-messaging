import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../lib/auth";
import { getApiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

export default function LoginForm() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!phone.trim() || !password.trim()) {
      setError("Phone and password are required.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({
        phone: phone.trim(),
        password,
      });
      setSession(response.data.token, response.data.user);
      navigate("/home", { replace: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label className="text-xs text-zinc-400">Phone Number</label>
        <input
          type="text"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+00 0000000000"
          className="
            w-full rounded-xl bg-zinc-900 border border-zinc-800
            px-4 py-3 text-sm text-white
            placeholder:text-zinc-500
            outline-none
            focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            transition
          "
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-zinc-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
          className="
            w-full rounded-xl bg-zinc-900 border border-zinc-800
            px-4 py-3 text-sm text-white
            placeholder:text-zinc-500
            outline-none
            focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            transition
          "
        />
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="
          w-full mt-2 rounded-xl
          bg-primary-gradient hover:bg-indigo-700
          text-white text-sm font-medium
          py-3
          transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70
        "
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
