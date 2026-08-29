/**
 * Design tokens — sumber: design.md §2 (warna), §3 (tipografi), §8 (motion).
 * Semua komponen memakai nama token ini (via Tailwind), bukan hex mentah — design §9.
 */

export const colors = {
  bg: '#111214',
  bgSecondary: '#15171A',
  surface: '#1A1C20',
  elevated: '#202329',
  border: 'rgba(255,255,255,0.06)',
  text: {
    primary: '#F5F5F4',
    secondary: '#A1A1AA',
    muted: '#71717A',
  },
  tier: {
    SS: '#F5C166',
    S: '#BB6CFF',
    A: '#4E6AFF',
    B: '#34D399',
    C: '#FFB04A',
    D: '#EF4444',
    Unrated: '#52525B',
  },
  /** Primary/brand — emas-amber, selaras tier SS (design §2 Aksen). */
  brand: '#F5C166',
  /** Status baca biner (design §4 Status Indicators). */
  status: {
    read: '#34D399',
    unread: '#52525B',
  },
} as const;

/** Durasi transisi modal/sheet — design §8 (150–200ms). */
export const motion = {
  fast: 150,
  base: 200,
  coverHoverScale: 1.03,
} as const;

export type TierName = keyof typeof colors.tier;

/** Urutan tier untuk Tier View & sort — design §5-5, req FR-12. */
export const TIER_ORDER: TierName[] = ['SS', 'S', 'A', 'B', 'C', 'D', 'Unrated'];
