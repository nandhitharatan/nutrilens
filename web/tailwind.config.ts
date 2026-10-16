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
        parchment: {
          DEFAULT: "#F1EDE4",
          light: "#F8F6F1",
          dark: "#E3DDD2",
          card: "#FFFFFF",
        },
        oxblood: {
          DEFAULT: "#A23B32",
          hover: "#8E322A",
          light: "#FBECEB",
        },
        ink: {
          DEFAULT: "#26231F",
          muted: "#66615B",
          subtle: "#8E8881",
          border: "#DCD5C9",
        },
        gold: {
          DEFAULT: "#E3B95B",
          light: "#FCF7EB",
          dark: "#C69B37",
        },
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
