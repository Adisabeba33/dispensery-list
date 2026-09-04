import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080b0a',
          900: '#0c110f',
          850: '#111815',
          800: '#161f1b',
          700: '#1f2b25',
          600: '#2b3a32',
        },
        moss: {
          400: '#63dd97',
          500: '#3fc97d',
          600: '#2ba766',
        },
        chalk: {
          50: '#f2f6f3',
          200: '#c3cec8',
          400: '#8b9a93',
          500: '#6d7d76',
        },
        amber: { 400: '#f2b544' },
        rust: { 400: '#ef6f62' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: { content: '76rem' },
    },
  },
  plugins: [],
};

export default config;
