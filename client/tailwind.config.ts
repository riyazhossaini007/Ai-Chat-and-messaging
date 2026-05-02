/** @type {import('tailwindcss').Config} */

import type { Config } from "tailwindcss";

const config: Config = {
   darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          main: "#020617",     // deeper slate (cleaner than pure black)
          surface: "#0F172A",  // slate-900
          elevated: "#111827"  // slate/gray hybrid for cards
        },

        text: {
          primary: "#F8FAFC",   // slate-50
          secondary: "#CBD5F5", // soft cool text
          muted: "#64748B",     // slate-500
        },

        border: {
          subtle: "#1E293B",   // slate-800
          strong: "#334155",   // slate-700
        },

        primary: {
          cyan: "#22D3EE",     // main accent (AI feel)
          cyanDeep: "#06B6D4", // hover / active
          emerald: "#34D399",  // credits / success
        },

        semantic: {
          success: "#34D399", // emerald
          warning: "#FACC15",
          error: "#EF4444",
          info: "#22D3EE",    // cyan info instead of sky
        },
      },

      backgroundImage: {
        "primary-gradient":
          "linear-gradient(135deg, #22D3EE 0%, #06B6D4 40%, #34D399 100%)",

        "primary-glow":
          "radial-gradient(circle at center, rgba(34,211,238,0.35), transparent 70%)",

        "emerald-glow":
          "radial-gradient(circle at center, rgba(52,211,153,0.30), transparent 70%)",
      },

      boxShadow: {
        glow: "0 0 40px rgba(34,211,238,0.45)",
        "glow-sm": "0 0 20px rgba(34,211,238,0.35)",
        "emerald-glow": "0 0 35px rgba(52,211,153,0.35)",
      },
    },
  },
  plugins: [],
}

export default config
