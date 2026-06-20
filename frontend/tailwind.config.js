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
          primary: "#1f8f6b",
          "primary-content": "#ffffff",
          secondary: "#25a06f",
          "secondary-content": "#ffffff",
          accent: "#22c55e",
          "accent-content": "#04240f",
          neutral: "#14201a",
          "neutral-content": "#eef3f0",
          "base-100": "#ffffff",
          "base-200": "#f1f5f3",
          "base-300": "#e0e8e3",
          "base-content": "#13201a",
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
          primary: "#1f6e5c",
          "primary-content": "#ffffff",
          secondary: "#2a8f74",
          "secondary-content": "#04241b",
          accent: "#22c55e",
          "accent-content": "#04240f",
          neutral: "#1b2620",
          "neutral-content": "#cdd9d2",
          "base-100": "#0c1711",
          "base-200": "#18241e",
          "base-300": "#28342d",
          "base-content": "#e7ece9",
          info: "#38bdf8",
          success: "#22c55e",
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
