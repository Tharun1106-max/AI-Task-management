import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#0B0F19", // Deep slate/midnight base
          subtle: "#111827",
          card: "rgba(17, 24, 39, 0.7)",
          elevated: "rgba(31, 41, 55, 0.75)",
        },
        brand: {
          indigo: "#6366F1",
          violet: "#8B5CF6",
          cyan: "#06B6D4",
          fuchsia: "#D946EF",
          emerald: "#10B981",
        },
        glow: {
          indigo: "rgba(99, 102, 241, 0.35)",
          violet: "rgba(139, 92, 246, 0.35)",
          cyan: "rgba(6, 182, 212, 0.35)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.08)",
          glass: "rgba(255, 255, 255, 0.15)",
          active: "rgba(99, 102, 241, 0.5)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        "glass-sm": "0 2px 10px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
        "glass-md": "0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
        "glass-lg": "0 20px 50px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)",
        "glow-indigo": "0 0 25px -5px rgba(99, 102, 241, 0.5)",
        "glow-cyan": "0 0 25px -5px rgba(6, 182, 212, 0.5)",
        "glow-violet": "0 0 25px -5px rgba(139, 92, 246, 0.5)",
      },
      animation: {
        "border-shine": "borderShine 4s linear infinite",
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "orb-float": "orbFloat 18s ease-in-out infinite",
        "mesh-drift": "meshDrift 20s ease infinite",
      },
      keyframes: {
        borderShine: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        orbFloat: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(40px, -60px) scale(1.1)" },
          "66%": { transform: "translate(-30px, 30px) scale(0.95)" },
        },
        meshDrift: {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(180deg) scale(1.15)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
