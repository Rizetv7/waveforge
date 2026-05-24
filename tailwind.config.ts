import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        aura: {
          night: "#12100f",
          panel: "#e8ddc8",
          panelDeep: "#d9c9ad",
          ink: "#17110e",
          ember: "#f2692e",
          amber: "#f7a23b",
          mint: "#72dbad",
          sky: "#83bbd9",
          berry: "#d06c98",
        },
      },
      boxShadow: {
        hardware: "0 28px 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.55)",
        insetSoft: "inset 0 2px 8px rgba(255,255,255,.45), inset 0 -8px 20px rgba(44,31,18,.12)",
        led: "0 0 18px rgba(242,105,46,.45)",
      },
    },
  },
  plugins: [],
} satisfies Config;
