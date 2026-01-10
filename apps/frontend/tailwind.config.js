/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          light: "#f7f4ef",
          dark: "#1b1a17"
        },
        accent: {
          light: "#e07a5f",
          dark: "#f2cc8f"
        }
      }
    }
  },
  plugins: []
};
