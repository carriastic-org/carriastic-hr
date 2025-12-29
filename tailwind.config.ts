import type { Config } from "tailwindcss";
import nextAdminPreset from "@premieroctet/next-admin/preset";
import daisyui from "daisyui";
import tailwindScrollbar from "tailwind-scrollbar";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@premieroctet/next-admin/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  presets: [nextAdminPreset],
  theme: {
    screens: {
      sm: "280px",
      md: "768px",
      md1: "1200px",
      lg: "1440px",
      xl: "1920px",
    },
    fontFamily: {
      sans: ["var(--font-geist-sans)", "Inter", "sans-serif"],
      mono: ["var(--font-geist-mono)", "monospace"],
      inter: ["Inter", "sans-serif"],
      cormorant_infant: ["cormorant_infant"],
    },
    boxShadow: {
      DEFAULT:
        "0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px rgba(0, 0, 0, 0.14), 0px 1px 5px rgba(0, 0, 0, 0.12)",
    },
    borderWidth: {
      DEFAULT: "1px",
    },
    borderRadius: {
      DEFAULT: "10px",
      full: "9999px",
    },
    extend: {
      colors: {
        primary: "#0dbad2",
        text_primary: "#7e7d7d",
        text_bold: "#555454",
        tertiary: "#F44336",
        primary_light: "#B2EBF2",
        primary_dark: "#037887",
      },
      keyframes: {
        tutorialScroll34: {
          "0%, 20%": { transform: "translateY(0)", opacity: "1" },
          "30%": { transform: "translateY(-34%)", opacity: "1" },
          "60%": { transform: "translateY(-34%)", opacity: "1" },
          "64%": { transform: "translateY(-34%)", opacity: "1" },
          "65%": { transform: "translateY(-34%)", opacity: "0" },
          "66%": { transform: "translateY(0)", opacity: "0" },
          "70%, 100%": { transform: "translateY(0)", opacity: "1" },
        },
        tutorialScroll42: {
          "0%, 20%": { transform: "translateY(0)", opacity: "1" },
          "30%": { transform: "translateY(-42%)", opacity: "1" },
          "60%": { transform: "translateY(-42%)", opacity: "1" },
          "64%": { transform: "translateY(-42%)", opacity: "1" },
          "65%": { transform: "translateY(-42%)", opacity: "0" },
          "66%": { transform: "translateY(0)", opacity: "0" },
          "70%, 100%": { transform: "translateY(0)", opacity: "1" },
        },
        tutorialScroll45: {
          "0%, 20%": { transform: "translateY(0)", opacity: "1" },
          "30%": { transform: "translateY(-44%)", opacity: "1" },
          "60%": { transform: "translateY(-44%)", opacity: "1" },
          "64%": { transform: "translateY(-44%)", opacity: "1" },
          "65%": { transform: "translateY(-44%)", opacity: "0" },
          "66%": { transform: "translateY(0)", opacity: "0" },
          "70%, 100%": { transform: "translateY(0)", opacity: "1" },
        },
        tutorialScroll: {
          "0%, 20%": { transform: "translateY(0)", opacity: "1" },
          "30%": { transform: "translateY(-50%)", opacity: "1" },
          "60%": { transform: "translateY(-50%)", opacity: "1" },
          "64%": { transform: "translateY(-50%)", opacity: "1" },
          "65%": { transform: "translateY(-50%)", opacity: "0" },
          "66%": { transform: "translateY(0)", opacity: "0" },
          "70%, 100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        tutorialScroll: "tutorialScroll 10s ease-in-out infinite",
        tutorialScroll34: "tutorialScroll34 10s ease-in-out infinite",
        tutorialScroll42: "tutorialScroll42 10s ease-in-out infinite",
        tutorialScroll45: "tutorialScroll45 10s ease-in-out infinite",
      },
      backgroundImage: {
        "arrow-down-v2":
          "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" viewBox=\"0 0 400 400\"><path d=\"M0,101.08h404.308L202.151,303.229L0,101.08z\"/></svg>') ",
        "arrow-down":
          "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"12.35\" viewBox=\"0 0 20 12.35\"><path id=\"Path_43\" data-name=\"Path 43\" d=\"M23.65,8.59,16,16.223,8.35,8.59,6,10.94l10,10,10-10Z\" transform=\"translate(-6 -8.59)\" fill=\"gray\"/></svg>') ",
        "arrow-up":
          "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"12.35\" viewBox=\"0 0 20 12.35\"><path id=\"Path_43\" data-name=\"Path 43\" d=\"M23.65,8.59,16,16.223,8.35,8.59,6,10.94l10,10,10-10Z\" transform=\"translate(26 20.94) rotate(-180)\" fill=\"gray\"/></svg>') ",
      },
      maxWidth: {
        "fill-available": "-webkit-fill-available",
      },
    },
  },
  daisyui: {
    styled: false,
    themes: [
      {
        default: {
          primary: "#4E61F6",
          secondary: "#EDEFFE",
          accent: "#B881FF",
          neutral: "#FFFFFF",
          hover: "#3745AF",
          "base-content": "#F6F4F4",
          "bg-100": "#94A2B3",
          "bg-200": "#F0F5F7",
          "bg-300": "#F5F5F5",
          "bg-400": "#E6E9EC",
          text: "#231916",
        },
      },
    ],
    base: false,
    utils: true,
    logs: false,
    rtl: false,
  },
  plugins: [daisyui, tailwindScrollbar],
};

export default config;
