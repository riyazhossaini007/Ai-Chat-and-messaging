import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser, verifyOtp } from "../../lib/auth";
import { getApiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

type RegisterStage = "register" | "verify";

export default function RegisterForm() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [stage, setStage] = useState<RegisterStage>("register");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError("Name, phone and password are required.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
      setStage("verify");
      setMessage("OTP sent. Enter OTP to complete signup.");
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!phone.trim() || !otp.trim()) {
      setError("Phone and OTP are required.");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOtp({
        phone: phone.trim(),
        otp: otp.trim(),
      });
      setSession(response.data.token, response.data.user);
      navigate("/home", { replace: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  if (stage === "verify") {
    return (
      <form className="space-y-6" onSubmit={handleVerify}>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
            Phone Number
          </label>
          <input
            type="tel"
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
          <label className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
            OTP
          </label>
          <input
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="Enter OTP"
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

        {message ? <p className="text-[11px] text-emerald-400">{message}</p> : null}
        {error ? <p className="text-[11px] text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full h-11
            rounded-xl
            bg-primary-gradient
            text-sm font-semibold
            text-white
            tracking-wide
            hover:bg-indigo-500
            active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70
            transition-all
          "
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleRegister}>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
          Full Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
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
        <label className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
          Phone Number
        </label>
        <input
          type="tel"
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
        <label className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a strong password"
          className="
            w-full rounded-xl bg-zinc-900 border border-zinc-800
            px-4 py-3 text-sm text-white
            placeholder:text-zinc-500
            outline-none
            focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            transition
          "
        />
        <p className="text-[11px] text-zinc-500">
          Minimum 8 characters, mix letters and numbers
        </p>
      </div>

      {message ? <p className="text-[11px] text-emerald-400">{message}</p> : null}
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="
          w-full h-11
          rounded-xl
          bg-primary-gradient
          text-sm font-semibold
          text-white
          tracking-wide
          hover:bg-indigo-500
          active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70
          transition-all
        "
      >
        {loading ? "Creating..." : "Create Account"}
      </button>

      <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
        By creating an account, you agree to our{" "}
        <span className="text-zinc-300 hover:text-white cursor-pointer">terms</span> and{" "}
        <span className="text-zinc-300 hover:text-white cursor-pointer">
          privacy policy
        </span>
      </p>
    </form>
  );
}
