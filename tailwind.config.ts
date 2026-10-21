import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* A register read at night: black with green in it, and one neon green
         kept for what the register vouches for — a licence, a shelf read. */
      colors: {
        ink: {
          950: '#040a07',
          900: '#07110c',
          850: '#0a1611',
          800: '#0e1d16',
          700: '#1a2d23',
          600: '#284032',
        },
        moss: {
          300: '#86f5b8',
          400: '#41e591',
          500: '#25d17b',
          600: '#18b467',
          700: '#0f7c47',
        },
        chalk: {
          50: '#eef5f0',
          100: '#dde7e1',
          200: '#c0cdc5',
          300: '#a4b3aa',
          400: '#879990',
          500: '#687a71',
        },
        amber: { 300: '#f7cb6e', 400: '#f2b544' },
        rust: { 400: '#ef6f62' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: { content: '76rem' },
      /* Where the header takes over the five sections from the phone's bar.
         In em, so a reader who sets a larger text size gets the bar until the
         row really fits: 768px at the default size, 960px at 20px. */
      screens: { nav: '48em' },
    },
  },
  plugins: [],
};

export default config;
