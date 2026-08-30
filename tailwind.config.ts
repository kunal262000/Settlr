import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#102A43',
          dark: '#081C2C',
        },
        teal: {
          DEFAULT: '#0F766E',
          soft: '#CCFBF1',
        },
        bg: '#F7F8F6',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#17212B',
          muted: '#64748B',
        },
        border: '#E5E7EB',
        success: { DEFAULT: '#15803D', bg: '#F0FDF4' },
        warning: { DEFAULT: '#B45309', bg: '#FFFBEB' },
        error: { DEFAULT: '#B91C1C', bg: '#FEF2F2' },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 42, 67, 0.04), 0 4px 12px rgba(16, 42, 67, 0.06)',
        card: '0 1px 3px rgba(16, 42, 67, 0.06), 0 8px 24px rgba(16, 42, 67, 0.05)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};

export default config;
