import type { Config } from "tailwindcss";

// Mapped 1:1 from .claude/design-tokens.md
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        bg: "#ffffff",
        border: {
          DEFAULT: "#ececec",
          input: "#e4e4e7",
          "input-hover": "#d4d4d8",
        },
        ink: {
          primary: "#0a0a0a",
          secondary: "#71717a",
          label: "#3f3f46",
          placeholder: "#a1a1aa",
        },
        accent: "#2563eb",
        brand: {
          top: "#3b82f6",
          bottom: "#1d4ed8",
        },
      },
      borderRadius: {
        card: "16px",
        input: "9px",
        btn: "6px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.03), 0 10px 24px -12px rgba(0,0,0,.08)",
        "btn-primary":
          "0 1px 2px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.25)",
        "btn-primary-hover":
          "0 1px 2px rgba(0,0,0,.1), 0 3px 8px rgba(30,144,255,.5), inset 0 1px 0 rgba(255,255,255,.25)",
        focus: "0 0 0 3px rgba(10,10,10,.06)",
      },
      fontSize: {
        logo: ["16px", { letterSpacing: "-0.01em" }],
        h1: ["20px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        subtext: ["12.5px", { lineHeight: "1.4" }],
        label: ["12px", { lineHeight: "1.2" }],
        input: ["13px", { lineHeight: "1.4" }],
        btn: ["13.5px", { lineHeight: "1.2" }],
        divider: ["10px", { lineHeight: "1", letterSpacing: "0.05em" }],
        footer: ["12.5px", { lineHeight: "1.4" }],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
