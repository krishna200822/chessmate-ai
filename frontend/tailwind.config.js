/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          DEFAULT: '#ccff00',
          300: '#d9ff33',
          400: '#ccff00',
          500: '#bbf43d',
          600: '#a3e635',
        },
        obsidian: {
          DEFAULT: '#0a0a0a',
          950: '#0a0a0a',
          900: '#121214',
          850: '#18181b',
          800: '#27272a',
          700: '#3f3f46',
        },
        editorial: {
          bg: '#fcfcfd',
          card: '#ffffff',
          surface: '#f4f4f5',
          border: '#e4e4e7',
          text: '#0a0a0a',
          secondary: '#52525b',
          muted: '#71717a',
        },
        command: {
          950: '#fcfcfd',
          900: '#ffffff',
          850: '#f4f4f5',
          800: '#e4e4e7',
          700: '#d4d4d8',
          600: '#a1a1aa',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'editorial': '0 10px 30px rgba(0,0,0,0.04)',
        'editorial-lg': '0 20px 40px -15px rgba(0,0,0,0.07)',
        'lime-glow': '0 0 20px rgba(204, 255, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
