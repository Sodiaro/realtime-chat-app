import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: ["Sora", "Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
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
          primary: "#10367D",
          "primary-content": "#ffffff",
          secondary: "#2452a8",
          "secondary-content": "#ffffff",
          accent: "#A5CE00",
          "accent-content": "#10367D",
          neutral: "#10367D",
          "neutral-content": "#EBEBEB",
          "base-100": "#ffffff",
          "base-200": "#EBEBEB",
          "base-300": "#d6d8de",
          "base-content": "#16223f",
          info: "#10367D",
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
          primary: "#3b63c9",
          "primary-content": "#ffffff",
          secondary: "#5b8def",
          "secondary-content": "#061226",
          accent: "#A5CE00",
          "accent-content": "#10213d",
          neutral: "#1a2236",
          "neutral-content": "#EBEBEB",
          "base-100": "#0e1626",
          "base-200": "#0a1120",
          "base-300": "#1c2740",
          "base-content": "#e6eaf2",
          info: "#60a5fa",
          success: "#84cc16",
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
