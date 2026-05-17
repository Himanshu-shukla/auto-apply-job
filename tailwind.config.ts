import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        mist: "#eef3f5"
      },
      boxShadow: {
        soft: "0 8px 28px rgba(23, 32, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
