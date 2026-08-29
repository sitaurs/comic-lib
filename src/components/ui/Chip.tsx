import type { ReactNode } from 'react';
import type { ReadingStatus, Tier } from '../../db/types';

/** design §4 — Tier chip: pill kecil berwarna sesuai tier. */
const TIER_CLASS: Record<Tier, string> = {
  SS: 'bg-tier-ss/20 text-tier-ss ring-tier-ss/40',
  S: 'bg-tier-s/20 text-tier-s ring-tier-s/40',
  A: 'bg-tier-a/20 text-tier-a ring-tier-a/40',
  B: 'bg-tier-b/20 text-tier-b ring-tier-b/40',
  C: 'bg-tier-c/20 text-tier-c ring-tier-c/40',
  D: 'bg-tier-d/20 text-tier-d ring-tier-d/40',
  Unrated: 'bg-tier-unrated/20 text-text-muted ring-tier-unrated/40',
};

const TIER_SOLID: Record<Tier, string> = {
  SS: 'bg-tier-ss text-bg',
  S: 'bg-tier-s text-bg',
  A: 'bg-tier-a text-white',
  B: 'bg-tier-b text-bg',
  C: 'bg-tier-c text-bg',
  D: 'bg-tier-d text-white',
  Unrated: 'bg-tier-unrated text-text-primary',
};

export function TierChip({
  tier,
  solid = false,
  size = 'sm',
  className = '',
}: {
  tier: Tier;
  solid?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const label = tier === 'Unrated' ? '—' : tier;
  const dim =
    size === 'xs'
      ? 'h-5 min-w-5 px-1.5 text-[10px]'
      : size === 'md'
        ? 'h-7 min-w-7 px-2.5 text-sm'
        : 'h-6 min-w-6 px-2 text-xs';
  return (
    <span
      aria-label={`Tier ${tier}`}
      className={`inline-flex items-center justify-center rounded-full font-bold tabular-nums ${dim} ${
        solid ? TIER_SOLID[tier] : `ring-1 ${TIER_CLASS[tier]}`
      } ${className}`}
    >
      {label}
    </span>
  );
}

/** design §4 — Badge chip: pill elevated; varian editable punya tombol x. */
export function Chip({
  children,
  onClick,
  onRemove,
  active = false,
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  active?: boolean;
  className?: string;
  title?: string;
}) {
  const base = `inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors duration-fast ${
    active
      ? 'border-brand/60 bg-brand/15 text-brand'
      : 'border-hairline bg-elevated text-text-secondary hover:text-text-primary'
  } ${className}`;

  const content = <span className="truncate">{children}</span>;

  if (onRemove) {
    return (
      <span className={base} title={title}>
        {onClick ? (
          <button type="button" onClick={onClick} className="truncate">
            {children}
          </button>
        ) : (
          content
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Lepas badge"
          className="-mr-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-bg/60 hover:text-text-primary"
        >
          ×
        </button>
      </span>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base} title={title}>
        {content}
      </button>
    );
  }

  return (
    <span className={base} title={title}>
      {content}
    </span>
  );
}

/** design §4 — Status Indicators: dot hijau (pernah baca) / abu (belum). */
export function StatusDot({
  status,
  className = '',
}: {
  status: ReadingStatus;
  className?: string;
}) {
  const read = status === 'pernah_baca';
  return (
    <span
      aria-label={read ? 'Pernah Baca' : 'Belum Baca'}
      title={read ? 'Pernah Baca' : 'Belum Baca'}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-bg/70 ${
        read ? 'bg-status-read' : 'bg-status-unread'
      } ${className}`}
    />
  );
}

/** design §4 — Pill "Pernah Baca". */
export function ReadingStatusPill({ status }: { status: ReadingStatus }) {
  const read = status === 'pernah_baca';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        read
          ? 'bg-status-read/15 text-status-read'
          : 'bg-elevated text-text-muted border border-hairline'
      }`}
    >
      {read ? '✓' : '○'} {read ? 'Pernah Baca' : 'Belum Baca'}
    </span>
  );
}
