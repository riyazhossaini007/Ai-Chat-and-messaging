import { useState } from "react";
import LoginForm from "../components/AuthComponents/LoginForm";
import RegisterForm from "../components/AuthComponents/RegisterForm";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      
      {/* subtle background glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div
        className="
          relative z-10
          w-full max-w-md
          bg-zinc-900/80 backdrop-blur
          border border-zinc-800
          rounded-2xl
          p-7
          shadow-xl
          transition-all
        "
      >
        {/* Header */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-semibold text-white">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h1>

          <p className="text-zinc-400 text-sm mt-1">
            {mode === "login"
              ? "Login to continue to your account"
              : "Join the platform in seconds"}
          </p>
        </div>

        {/* Form */}
        <div className="transition-all duration-300">
          {mode === "login" ? <LoginForm /> : <RegisterForm />}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-500">OR</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* Switch */}
        <div className="text-center text-sm text-zinc-400">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-white font-medium hover:text-indigo-400 transition"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-white font-medium hover:text-indigo-400 transition"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
