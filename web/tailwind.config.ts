import type { Config } from 'tailwindcss';
import { PALETTE } from './lib/theme';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui
        border: 'var(--border)', input: 'var(--input)', ring: 'var(--ring)',
        background: 'var(--background)', foreground: 'var(--foreground)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        // dominio handball
        hb: {
          panel: PALETTE.panel, panel2: PALETTE.panel2, panel3: PALETTE.panel3,
          line: PALETTE.line, lineSoft: PALETTE.lineSoft,
          text: PALETTE.text, muted: PALETTE.muted, faint: PALETTE.faint,
          amber: PALETTE.amber, home: PALETTE.home, away: PALETTE.away,
          goal: PALETTE.goal, save: PALETTE.save, neg: PALETTE.neg, warn: PALETTE.warn,
        },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Roboto Mono', 'monospace'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
