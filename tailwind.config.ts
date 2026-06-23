import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8F7F5",
        card: "#FFFFFF",
        dark: "#0D0D0D",
        "text-primary": "#1A1A1A",
        "text-secondary": "#888780",
        "text-muted": "#B4B2A9",
        border: "#D3D1C7",
        "border-light": "#E8E6E0",
        "side-a": "#378ADD",
        "side-a-bg": "#E6F1FB",
        "side-a-dark": "#185FA5",
        "side-b": "#7F77DD",
        "side-b-bg": "#EEEDFE",
        "side-b-dark": "#534AB7",
        online: "#4ADE80",
        warning: "#854F0B",
        "warning-bg": "#FFF8E8",
        error: "#A32D2D",
        "error-bg": "#FCEBEB",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "bar-grow": "bar-grow 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in": "fade-in 0.3s ease forwards",
      },
      keyframes: {
        "bar-grow": {
          from: { width: "0%" },
          to: { width: "var(--bar-width)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
