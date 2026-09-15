/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F6F9',
        ink: '#16182E',
        primary: {
          DEFAULT: '#1E2A78',
          hover: '#16205C',
        },
        accent: {
          DEFAULT: '#F59E0B',
          hover: '#B45309',
        },
        success: {
          bg: '#DCFCE7',
          text: '#166534',
        },
        danger: {
          bg: '#FEE2E2',
          text: '#B42318',
        },
        warning: {
          bg: '#FEF3C7',
          text: '#8C4A17',
        },
        info: {
          bg: '#E8EAF6',
          text: '#1E2A78',
        },
        neutral: {
          bg: '#EFEFF3',
          text: '#4B4F63',
        },
      },
      fontFamily: {
        heading: ['Caprasimo', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '28px',
        tile: '24px',
      },
    },
  },
  plugins: [],
};
