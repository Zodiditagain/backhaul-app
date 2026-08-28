/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        concrete: "#4A4A4A",
        asphalt: "#1E1E1E",
        amberx: "#F59E0B",
        alertred: "#EF4444",
        steelgray: "#9CA3AF",
        highway: "#22C55E",
      },
    },
  },
  plugins: [],
};
