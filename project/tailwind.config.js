/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B0F1A',
          50: '#1A2033',
          100: '#151A2B',
          200: '#0B0F1A',
        },
        gold: {
          DEFAULT: '#D4AF37',
          50: '#F5EDD6',
          100: '#EFE3C3',
          200: '#E4D09D',
          300: '#D9BD77',
          400: '#D4AF37',
          500: '#B89730',
          600: '#997E28',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
