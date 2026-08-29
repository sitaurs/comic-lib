import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Tier, Title } from '../db/types';
import { TIER_ORDER } from '../design/tokens';
import { PageHeader, EmptyState } from '../components/layout/PageHeader';
import { CoverCard } from '../components/library/CoverCard';
import { Button } from '../components/ui/Button';
import { TierChip } from '../components/ui/Chip';
import { useTitles } from '../hooks/useLibraryData';
import { useFilterStore } from '../stores/filterStore';

/**
 * Tier View — design §5-5, req FR-12 (L61–L62).
 * Satu baris per tier SS → S → A → B → C → D → Unrated, berisi cover
 * (scroll horizontal) + jumlah judul. Klik jumlah → Library terfilter tier itu.
 */
export function TierViewPage() {
  const titles = useTitles();
  const setTierFilter = useFilterStore((s) => s.toggleTier);
  const clear = useFilterStore((s) => s.clear);

  const byTier = useMemo(() => {
    const map = new Map<Tier, Title[]>(TIER_ORDER.map((t) => [t, []]));
    for (const t of titles ?? []) map.get(t.tier)?.push(t);
    for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    return map;
  }, [titles]);

  if (titles === undefined) {
    return (
      <>
        <PageHeader title="Tier View" />
        <p className="py-16 text-center text-sm text-text-muted">Memuat…</p>
      </>
    );
  }

  if (titles.length === 0) {
    return (
      <>
        <PageHeader title="Tier View" />
        <EmptyState
          icon="◆"
          title="Belum ada judul untuk diberi tier"
          description="Tambah atau impor judul dulu, lalu beri tier SS–D."
          action={
            <Link to="/library">
              <Button variant="primary">Ke Library</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tier View"
        subtitle={`${titles.length} judul dikelompokkan per tier`}
      />

      <div className="space-y-4">
        {TIER_ORDER.map((tier) => {
          const list = byTier.get(tier) ?? [];
          return (
            <section
              key={tier}
              className="rounded-2xl border border-hairline bg-surface/50 p-3 md:p-4"
            >
              <div className="mb-3 flex items-center gap-3">
                <TierChip tier={tier} size="md" solid />
                <h2 className="font-display text-base font-semibold tracking-editorial">
                  {tier === 'Unrated' ? 'Belum diberi tier' : `Tier ${tier}`}
                </h2>
                <Link
                  to="/library"
                  onClick={() => {
                    clear();
                    setTierFilter(tier);
                  }}
                  className="ml-auto text-xs text-text-muted transition-colors hover:text-brand"
                >
                  {list.length} judul →
                </Link>
              </div>

              {list.length === 0 ? (
                <p className="px-1 pb-1 text-xs text-text-muted">Kosong.</p>
              ) : (
                <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {list.map((t) => (
                    <div key={t.id} className="w-[104px] shrink-0 md:w-[120px]">
                      <CoverCard title={t} compact />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
