import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Title } from '../db/types';
import { PageHeader, EmptyState } from '../components/layout/PageHeader';
import { CoverRow } from '../components/home/CoverRow';
import { RandomPick } from '../components/home/RandomPick';
import { StatTiles } from '../components/home/StatTiles';
import { Button } from '../components/ui/Button';
import { useTitles } from '../hooks/useLibraryData';
import { useFilterStore } from '../stores/filterStore';

/**
 * Home — design §5-1, req FR-23 (L94–L95) & FR-24 (L97–L98).
 * 4 stat tile Bento + baris cover scroll horizontal + entri Random Pick 🎲.
 * Tanpa "Continue Reading"/progress chapter — status baca biner (design §5-1).
 */
export function HomePage() {
  const titles = useTitles();
  const clear = useFilterStore((s) => s.clear);
  const setFavoriteOnly = useFilterStore((s) => s.setFavoriteOnly);
  const toggleTier = useFilterStore((s) => s.toggleTier);
  const toggleReadingStatus = useFilterStore((s) => s.toggleReadingStatus);

  const groups = useMemo(() => {
    const all = titles ?? [];
    // Recently Added = createdAt desc (sort 'recent' di lib/filter)
    const recent = [...all].sort((a, b) => b.createdAt - a.createdAt);
    const byTitle = (a: Title, b: Title) => a.title.localeCompare(b.title, 'id');
    return {
      recent,
      favorites: all.filter((t) => t.favorite).sort(byTitle),
      unread: all.filter((t) => t.readingStatus === 'belum_baca').sort(byTitle),
      top: all.filter((t) => t.tier === 'SS' || t.tier === 'S').sort(byTitle),
    };
  }, [titles]);

  const stats = useMemo(() => {
    const all = titles ?? [];
    return {
      total: all.length,
      favorites: all.filter((t) => t.favorite).length,
      ss: all.filter((t) => t.tier === 'SS').length,
      unread: all.filter((t) => t.readingStatus === 'belum_baca').length,
    };
  }, [titles]);

  if (titles === undefined) {
    return (
      <>
        <PageHeader title="Home" subtitle="Ringkasan koleksi kamu" />
        <p className="py-16 text-center text-sm text-text-muted">Memuat…</p>
      </>
    );
  }

  // Empty state tenang bila library kosong (design §4, NFR-06)
  if (titles.length === 0) {
    return (
      <>
        <PageHeader title="Home" subtitle="Ringkasan koleksi kamu" />
        <EmptyState
          icon="⌂"
          title="Library masih kosong"
          description="Tambah judul pertama kamu, atau impor dari CSV/JSON/TXT di Settings."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/library">
                <Button variant="primary">Ke Library</Button>
              </Link>
              <Link to="/settings">
                <Button>Impor data</Button>
              </Link>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={`${stats.total} judul di rak kamu`}
        actions={<RandomPick titles={titles} />}
      />

      <div className="space-y-6">
        {/* design §5-1 — 4 stat tile Bento */}
        <StatTiles
          total={stats.total}
          favorites={stats.favorites}
          ss={stats.ss}
          unread={stats.unread}
        />

        {/* baris cover scroll horizontal — req FR-23; baris kosong disembunyikan */}
        <CoverRow
          heading="Recently Added"
          titles={groups.recent}
          onViewAll={() => {
            clear();
          }}
        />
        <CoverRow
          heading="Favorites"
          titles={groups.favorites}
          onViewAll={() => {
            clear();
            setFavoriteOnly(true);
          }}
        />
        <CoverRow
          heading="Belum Baca"
          titles={groups.unread}
          onViewAll={() => {
            clear();
            toggleReadingStatus('belum_baca');
          }}
        />
        <CoverRow
          heading="Top Tier (SS & S)"
          titles={groups.top}
          onViewAll={() => {
            clear();
            toggleTier('SS');
            toggleTier('S');
          }}
        />
      </div>
    </>
  );
}
