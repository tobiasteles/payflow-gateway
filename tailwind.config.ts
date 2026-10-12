import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#090D16",
        surface: "#111827",
        primary: "#6366F1",
        positive: "#10B981",
        danger: "#EF4444",
        warn: "#F59E0B",
        fg: "#F9FAFB",
        muted: "#9CA3AF",
      },
      borderColor: { subtle: "rgba(255,255,255,0.08)" },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
