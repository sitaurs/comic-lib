import type { Config } from 'tailwindcss';
import { colors, motion } from './src/design/tokens';

// design §9 — pemetaan token → Tailwind
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: colors.bg, secondary: colors.bgSecondary },
        surface: colors.surface,
        elevated: colors.elevated,
        hairline: colors.border,
        text: colors.text,
        tier: {
          ss: colors.tier.SS,
          s: colors.tier.S,
          a: colors.tier.A,
          b: colors.tier.B,
          c: colors.tier.C,
          d: colors.tier.D,
          unrated: colors.tier.Unrated,
        },
        brand: colors.brand,
        status: colors.status,
      },
      fontFamily: {
        // design §3 — satu keluarga sans modern + display untuk aksen editorial
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter Tight', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        editorial: '-0.02em',
      },
      transitionDuration: {
        fast: `${motion.fast}ms`,
        base: `${motion.base}ms`,
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.4)',
        card: '0 2px 8px rgba(0,0,0,0.3)',
      },
      scale: {
        cover: '1.03', // design §8
      },
    },
  },
  plugins: [],
} satisfies Config;
