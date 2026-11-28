/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
        "violet-glow": "0 3px 0 #4c1d95, 0 6px 14px rgba(0, 0, 0, 0.35)",
        "violet-glow-sm": "0 2px 0 #4c1d95, 0 4px 10px rgba(0, 0, 0, 0.28)",
        "green-glow": "0 3px 0 #15803d, 0 6px 14px rgba(0, 0, 0, 0.3)",
        "amber-glow": "0 3px 0 #b45309, 0 6px 14px rgba(0, 0, 0, 0.3)",
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
