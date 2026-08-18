/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,tsx}',
    './utils/**/*.{js,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neo: {
          yellow: '#FFE900',
          pink: '#FF6B6B',
          blue: '#4ECDC4',
          black: '#1A1A1A',
          white: '#FFFFFF',
          green: '#A3E635',
          dark: '#121212',
          'dark-card': '#1E1E1E',
          'dark-border': '#E5E7EB',
        },
      },
      boxShadow: {
        'neo': '5px 5px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '3px 3px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
        'neo-white': '5px 5px 0px 0px rgba(255,255,255,1)',
        'neo-sm-white': '3px 3px 0px 0px rgba(255,255,255,1)',
        'neo-lg-white': '8px 8px 0px 0px rgba(255,255,255,1)',
      },
    },
  },
  plugins: [],
};