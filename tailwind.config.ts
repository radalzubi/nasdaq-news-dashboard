import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: "hsl(var(--bg) / <alpha-value>)",
        "bg-elevated": "hsl(var(--bg-elevated) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        "card-hover": "hsl(var(--card-hover) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",

        // Text
        fg: "hsl(var(--fg) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        faint: "hsl(var(--faint) / <alpha-value>)",

        // Semantic market colors
        bull: "hsl(var(--bull) / <alpha-value>)",
        "bull-soft": "hsl(var(--bull-soft) / <alpha-value>)",
        bear: "hsl(var(--bear) / <alpha-value>)",
        "bear-soft": "hsl(var(--bear-soft) / <alpha-value>)",
        caution: "hsl(var(--caution) / <alpha-value>)",
        "caution-soft": "hsl(var(--caution-soft) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        "info-soft": "hsl(var(--info-soft) / <alpha-value>)",
        macro: "hsl(var(--macro) / <alpha-value>)",
        "macro-soft": "hsl(var(--macro-soft) / <alpha-value>)",

        accent: "hsl(var(--accent) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
