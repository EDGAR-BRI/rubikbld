/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#070a10',
          900: '#0c111d',
          850: '#111726',
          800: '#171f33',
          700: '#232f4c',
          600: '#324269',
        },
        bld: {
          primary: '#6366f1',
          accent: '#8b5cf6',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b',
          info: '#06b6d4',
        },
        cube: {
          u: '#f8fafc', // White
          l: '#f97316', // Orange
          f: '#10b981', // Green
          r: '#ef4444', // Red
          b: '#3b82f6', // Blue
          d: '#facc15', // Yellow
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'card-flip': 'cardFlip 0.35s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        }
      }
    },
  },
  plugins: [],
}
