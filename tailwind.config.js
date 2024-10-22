/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        '3dspin': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
      },
      animation: {
        '3dspin': '3dspin 5s linear infinite',
      },
      fontFamily: {
        magic: ['MagicMushroom', 'sans-serif'],
      },
      colors: {
        customGray: '#001319',
        trippyYellow: '#f9d73f'
      }
    },
  },
  plugins: [],
};
