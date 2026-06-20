import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        // soft, layered elevation (Linear/Vercel feel)
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
        card: "0 2px 8px -2px rgba(0,0,0,0.08), 0 4px 16px -4px rgba(0,0,0,0.06)",
        pop: "0 8px 30px -6px rgba(0,0,0,0.18)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: 0, transform: "scale(0.97)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.18s ease-out",
        "scale-in": "scale-in 0.14s ease-out",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    // a focused two-theme system built on design tokens
    themes: [
      {
        devlight: {
          "color-scheme": "light",
          primary: "#6366f1",
          "primary-content": "#ffffff",
          secondary: "#7c3aed",
          "secondary-content": "#ffffff",
          accent: "#0891b2",
          "accent-content": "#ffffff",
          neutral: "#1f2430",
          "neutral-content": "#f3f4f6",
          "base-100": "#ffffff",
          "base-200": "#f6f7f9",
          "base-300": "#e6e8ee",
          "base-content": "#1a1d24",
          info: "#0ea5e9",
          success: "#16a34a",
          warning: "#d97706",
          error: "#dc2626",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.6rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.2s",
          "--animation-input": "0.2s",
          "--border-btn": "1px",
          "--tab-radius": "0.6rem",
        },
      },
      {
        devdark: {
          "color-scheme": "dark",
          primary: "#6366f1",
          "primary-content": "#ffffff",
          secondary: "#a78bfa",
          "secondary-content": "#1a1530",
          accent: "#22d3ee",
          "accent-content": "#062630",
          neutral: "#1b2030",
          "neutral-content": "#cdd2dc",
          "base-100": "#0e1015",
          "base-200": "#161a23",
          "base-300": "#232938",
          "base-content": "#e6e9ef",
          info: "#38bdf8",
          success: "#34d399",
          warning: "#fbbf24",
          error: "#f87171",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.6rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.2s",
          "--animation-input": "0.2s",
          "--border-btn": "1px",
          "--tab-radius": "0.6rem",
        },
      },
    ],
    darkTheme: "devdark",
    logs: false,
  },
};
