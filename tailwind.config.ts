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
        // Sky Beauty B&W palette
        ink: "#000000",
        "ink-soft": "#0A0A0A",
        "ink-mid": "#111111",
        "ink-light": "#1A1A1A",
        "gray-900": "#222222",
        "gray-700": "#444444",
        "gray-500": "#777777",
        "gray-300": "#BBBBBB",
        "gray-200": "#DDDDDD",
        "gray-100": "#F0F0F0",
        snow: "#FAFAFA",
        // Keep legacy names mapped to B&W for quick swap
        cream: "#FAFAFA",
        beige: "#F0F0F0",
        gold: "#FFFFFF",
        "gold-light": "#E8E8E8",
        "gold-dark": "#444444",
        rose: "#1A1A1A",
        "rose-dark": "#111111",
        charcoal: "#000000",
        "warm-gray": "#777777",
        "light-gray": "#DDDDDD",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "fade-in": "fadeIn 1s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
