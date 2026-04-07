/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#020617', // Midnight
          50: '#0B1120',      // Night sky
          100: '#1E293B',
          200: '#334155',
        },
        gold: {
          DEFAULT: '#D4AF37', // Pure luxury Gold
          50: '#FDFBF5',
          100: '#F2E8C4',
          200: '#E6D38F',
          300: '#D4AF37',
          400: '#B8972D',
          500: '#8A7120',
          600: '#5C4B13',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"DM Serif Display"', 'serif'],
        sans: ['"Inter"', '"DM Sans"', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow': '0 0 20px 0 rgba(212, 175, 55, 0.4)',
      },
      animation: {
        'gradient-xy': 'gradient-xy 10s ease infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'gradient-xy': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': '0% 0%',
          },
          '50%': {
            'background-size': '400% 400%',
            'background-position': '100% 100%',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
};
