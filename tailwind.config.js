/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        telebot: {
          bg: "#0b0b0e",
          surface: "#121217",
          card: "#181820",
          "card-hover": "#1f1f2a",
          drawer: "#15151c",
          border: "#262630",
          "border-active": "#7c3aed",
          violet: "#7c3aed",
          "violet-light": "#8b5cf6",
          "violet-dark": "#4c1d95",
          green: "#22c55e",
          amber: "#f59e0b",
          rose: "#ef4444",
          muted: "#a1a1aa",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Inter",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "Fira Code",
          "Roboto Mono",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        "violet-glow": "0 0 20px rgba(124, 58, 237, 0.4)",
        "violet-glow-sm": "0 0 10px rgba(124, 58, 237, 0.3)",
        "green-glow": "0 0 16px rgba(34, 197, 94, 0.35)",
        "amber-glow": "0 0 16px rgba(245, 158, 11, 0.35)",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slide-up 0.25s ease-out forwards",
        "fade-in": "fade-in 0.2s ease-out forwards",
      },
    },
  },
  plugins: [],
}
