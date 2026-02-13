import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6750A4",
          container: "#EADDFF",
          on: "#FFFFFF",
          "on-container": "#21005D",
        },
        secondary: {
          DEFAULT: "#625B71",
          container: "#E8DEF8",
          on: "#FFFFFF",
          "on-container": "#1D192B",
        },
        tertiary: {
          DEFAULT: "#7D5260",
          container: "#FFD8E4",
          on: "#FFFFFF",
          "on-container": "#31111D",
        },
        surface: {
          DEFAULT: "#1C1B1F",
          dim: "#141218",
          bright: "#3B383E",
          "container-lowest": "#0F0D13",
          container: "#211F26",
          "container-high": "#2B2930",
          "container-highest": "#36343B",
        },
        "on-surface": {
          DEFAULT: "#E6E1E5",
          variant: "#CAC4D0",
        },
        outline: {
          DEFAULT: "#938F99",
          variant: "#49454F",
        },
        error: {
          DEFAULT: "#F2B8B5",
          container: "#8C1D18",
        },
        success: {
          DEFAULT: "#A8DAB5",
          container: "#1B5E20",
        },
      },
      borderRadius: {
        "xl": "16px",
        "2xl": "28px",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
