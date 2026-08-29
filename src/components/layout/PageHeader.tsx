import type { ReactNode } from 'react';

/** design §5 — Page Title editorial (§3 hirarki tipografi). */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-editorial md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** design §4 / req NFR-06 — empty state yang tenang. */
export function EmptyState({
  icon = '▦',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface/50 px-6 py-16 text-center">
      <span aria-hidden className="text-3xl text-text-muted">
        {icon}
      </span>
      <h2 className="font-display text-lg font-semibold tracking-editorial">{title}</h2>
      {description && <p className="max-w-md text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Section header antar blok (design §3). */
export function SectionHeader({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold tracking-editorial">{title}</h2>
      {aside}
    </div>
  );
}
