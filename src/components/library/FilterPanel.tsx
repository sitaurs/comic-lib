import { useMemo, useState } from 'react';
import type { ReadingStatus, Tier, WorkStatus } from '../../db/types';
import { TIER_ORDER } from '../../design/tokens';
import { useBadgeCategories, useBadges, useBadgeUsage } from '../../hooks/useLibraryData';
import { useFilterStore } from '../../stores/filterStore';
import { Button } from '../ui/Button';
import { TierChip } from '../ui/Chip';

/**
 * Advanced Filter — design §5-3, req FR-09/FR-10, spec §6 (L166–L190).
 * Section: Reading · Tier · Favorite · Badges (Match ALL/ANY) · Exclude · Clear,
 * dengan tombol utama "Show N titles" (count live).
 */
const READING: { value: ReadingStatus; label: string }[] = [
  { value: 'pernah_baca', label: 'Pernah Baca' },
  { value: 'belum_baca', label: 'Belum Baca' },
];

const WORK: { value: WorkStatus; label: string }[] = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'complete', label: 'Complete' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'unknown', label: 'Tidak diketahui' },
];

export function FilterPanel({
  resultCount,
  onApply,
}: {
  resultCount: number;
  onApply: () => void;
}) {
  const filter = useFilterStore();
  const badges = useBadges();
  const categories = useBadgeCategories();
  const usage = useBadgeUsage();
  const [badgeQuery, setBadgeQuery] = useState('');

  const grouped = useMemo(() => {
    if (!badges || !categories) return [];
    const needle = badgeQuery.trim().toLowerCase();
    return categories
      .map((cat) => ({
        category: cat,
        items: badges
          .filter((b) => b.categoryId === cat.id)
          .filter((b) => !needle || b.name.toLowerCase().includes(needle))
          .sort(
            (a, b) =>
              (usage?.get(b.id) ?? 0) - (usage?.get(a.id) ?? 0) || a.name.localeCompare(b.name),
          ),
      }))
      .filter((g) => g.items.length > 0);
  }, [badges, categories, usage, badgeQuery]);

  return (
    <div className="space-y-5">
      <Section title="Reading">
        <div className="flex flex-wrap gap-2">
          {READING.map((r) => (
            <FilterChip
              key={r.value}
              active={filter.readingStatus.has(r.value)}
              onClick={() => filter.toggleReadingStatus(r.value)}
            >
              {r.label}
            </FilterChip>
          ))}
        </div>
      </Section>

      <Section title="Tier">
        <div className="flex flex-wrap gap-2">
          {TIER_ORDER.map((tier: Tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => filter.toggleTier(tier)}
              aria-pressed={filter.tiers.has(tier)}
              className={`rounded-full border px-1.5 py-1 transition-colors duration-fast ${
                filter.tiers.has(tier)
                  ? 'border-brand/60 bg-brand/10'
                  : 'border-hairline hover:border-hairline/80'
              }`}
            >
              <TierChip tier={tier} size="xs" solid={filter.tiers.has(tier)} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Favorite">
        <FilterChip
          active={filter.favoriteOnly}
          onClick={() => filter.setFavoriteOnly(!filter.favoriteOnly)}
        >
          ♥ Hanya favorit
        </FilterChip>
      </Section>

      <Section title="Status Karya">
        <div className="flex flex-wrap gap-2">
          {WORK.map((w) => (
            <FilterChip
              key={w.value}
              active={filter.workStatus.has(w.value)}
              onClick={() => filter.toggleWorkStatus(w.value)}
            >
              {w.label}
            </FilterChip>
          ))}
        </div>
      </Section>

      <Section
        title="Badges"
        aside={
          <div className="flex items-center gap-1 rounded-full border border-hairline bg-elevated p-0.5 text-xs">
            {(['ALL', 'ANY'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => filter.setBadgeMatch(m)}
                aria-pressed={filter.badgeMatch === m}
                className={`rounded-full px-2 py-0.5 transition-colors duration-fast ${
                  filter.badgeMatch === m ? 'bg-brand text-bg font-semibold' : 'text-text-secondary'
                }`}
              >
                Match {m}
              </button>
            ))}
          </div>
        }
      >
        <input
          value={badgeQuery}
          onChange={(e) => setBadgeQuery(e.target.value)}
          placeholder="Cari badge…"
          aria-label="Cari badge"
          className="mb-2 w-full rounded-lg border border-hairline bg-bg/70 px-3 py-1.5 text-sm placeholder:text-text-muted focus:border-brand/50"
        />

        {grouped.length === 0 ? (
          <p className="text-xs text-text-muted">
            {badges?.length ? 'Tidak ada badge yang cocok.' : 'Belum ada badge.'}
          </p>
        ) : (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {grouped.map(({ category, items }) => (
              <div key={category.id}>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-text-muted">
                  {category.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((b) => {
                    const included = filter.badgeInclude.has(b.id);
                    const excluded = filter.badgeExclude.has(b.id);
                    return (
                      <span key={b.id} className="inline-flex items-stretch">
                        <button
                          type="button"
                          onClick={() => filter.toggleBadgeInclude(b.id)}
                          aria-pressed={included}
                          title={`Include ${b.name}`}
                          className={`rounded-l-full border py-1 pl-2.5 pr-1.5 text-xs transition-colors duration-fast ${
                            included
                              ? 'border-brand/60 bg-brand/15 text-brand'
                              : 'border-hairline bg-elevated text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {b.name}
                          <span className="ml-1 text-text-muted">{usage?.get(b.id) ?? 0}</span>
                        </button>
                        {/* Exclude terpisah agar Include/Exclude bisa dipilih independen (spec L187) */}
                        <button
                          type="button"
                          onClick={() => filter.toggleBadgeExclude(b.id)}
                          aria-pressed={excluded}
                          aria-label={`Exclude ${b.name}`}
                          title={`Exclude ${b.name}`}
                          className={`-ml-px rounded-r-full border px-1.5 py-1 text-xs transition-colors duration-fast ${
                            excluded
                              ? 'border-tier-d/60 bg-tier-d/20 text-tier-d'
                              : 'border-hairline bg-elevated text-text-muted hover:text-tier-d'
                          }`}
                        >
                          −
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {(filter.badgeExclude.size > 0 || filter.badgeInclude.size > 0) && (
        <Section title="Ringkasan">
          <p className="text-xs text-text-secondary">
            Include {filter.badgeInclude.size} badge (Match {filter.badgeMatch}) · Exclude{' '}
            {filter.badgeExclude.size} badge
          </p>
        </Section>
      )}

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={filter.clear} disabled={filter.activeCount() === 0}>
          Clear
        </Button>
        <Button variant="primary" className="flex-1" onClick={onApply}>
          Show {resultCount} titles
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** design §4 — Filter chip: pill toggle, state aktif = amber. */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors duration-fast ${
        active
          ? 'border-brand/60 bg-brand/15 text-brand'
          : 'border-hairline bg-elevated text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
