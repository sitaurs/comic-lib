import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Title } from '../db/types';
import { PageHeader, EmptyState } from '../components/layout/PageHeader';
import { CoverGrid } from '../components/library/CoverGrid';
import { AddTitleDialog } from '../components/library/AddTitleDialog';
import { QuickEditDialog } from '../components/library/QuickEditDialog';
import { FilterPanel } from '../components/library/FilterPanel';
import { BulkActionBar } from '../components/library/BulkActionBar';
import { Button, IconButton } from '../components/ui/Button';
import { AdaptiveDialog } from '../components/ui/Modal';
import { useBadgeMap, useCollectionMembers, useTitles } from '../hooks/useLibraryData';
import { applyFilter, SORT_LABELS } from '../lib/filter';
import { useFilterStore, type SortKey } from '../stores/filterStore';
import { useUIStore } from '../stores/uiStore';

/**
 * Library — design §5-2, req FR-01.
 * Toolbar: Search · Filter · Sort · Grid/Compact · Add Title.
 * Filter lengkap (FR-09/10) di panel adaptif: Modal desktop, BottomSheet mobile (§6).
 */
export function LibraryPage() {
  const titles = useTitles();
  const badgeMap = useBadgeMap();
  const filter = useFilterStore();
  const collectionMembers = useCollectionMembers(filter.collectionId);

  const viewMode = useUIStore((s) => s.viewMode);
  const toggleViewMode = useUIStore((s) => s.toggleViewMode);
  const selection = useUIStore((s) => s.selection);
  const selectionMode = useUIStore((s) => s.selectionMode);
  const setSelectionMode = useUIStore((s) => s.setSelectionMode);
  const toggleSelect = useUIStore((s) => s.toggleSelect);
  const selectMany = useUIStore((s) => s.selectMany);

  const [addOpen, setAddOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickEdit, setQuickEdit] = useState<Title | null>(null);

  const filtered = useMemo(() => {
    if (!titles) return [];
    return applyFilter(
      { titles, badgeMap: badgeMap ?? new Map(), collectionMembers: collectionMembers ?? null },
      filter,
    );
  }, [titles, badgeMap, collectionMembers, filter]);

  const loading = titles === undefined;
  const totalCount = titles?.length ?? 0;
  const activeFilters = filter.activeCount();

  return (
    <>
      <PageHeader
        title="Library"
        subtitle={
          loading
            ? 'Memuat…'
            : filtered.length === totalCount
              ? `${totalCount} judul`
              : `${filtered.length} dari ${totalCount} judul`
        }
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            + Add Title
          </Button>
        }
      />

      {/* toolbar — design §5-2 (glass tipis saat mengambang di atas grid) */}
      <div className="glass sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 md:top-16">
        <input
          value={filter.search}
          onChange={(e) => filter.setSearch(e.target.value)}
          placeholder="Cari judul, judul Korea, alt title…"
          aria-label="Cari judul"
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-bg/70 px-3 py-1.5 text-sm placeholder:text-text-muted focus:border-brand/50"
        />

        <Button
          size="sm"
          variant={activeFilters > 0 ? 'primary' : 'secondary'}
          onClick={() => setFilterOpen(true)}
        >
          Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </Button>

        <select
          aria-label="Urutkan"
          value={filter.sort}
          onChange={(e) => filter.setSort(e.target.value as SortKey)}
          className="rounded-lg border border-hairline bg-bg/70 px-2 py-1.5 text-xs text-text-secondary"
        >
          {Object.entries(SORT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <Link to="/library/tiers" className="hidden sm:block">
          <Button size="sm" variant="ghost">
            Tier View
          </Button>
        </Link>

        <IconButton
          label={viewMode === 'grid' ? 'Ubah ke Compact' : 'Ubah ke Grid'}
          onClick={toggleViewMode}
        >
          {viewMode === 'grid' ? '▦' : '▪'}
        </IconButton>

        <IconButton
          label={selectionMode ? 'Keluar mode pilih' : 'Pilih beberapa judul'}
          variant={selectionMode ? 'primary' : 'ghost'}
          onClick={() => setSelectionMode(!selectionMode)}
        >
          ☑
        </IconButton>

        {activeFilters > 0 && (
          <Button size="sm" variant="ghost" onClick={filter.clear}>
            Clear
          </Button>
        )}
      </div>

      {selectionMode && filtered.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
          <button
            type="button"
            onClick={() => selectMany(filtered.map((t) => t.id))}
            className="rounded-lg border border-hairline px-2 py-1 transition-colors duration-fast hover:text-text-primary"
          >
            Pilih semua {filtered.length} hasil
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-muted">Memuat library…</p>
      ) : (
        <CoverGrid
          titles={filtered}
          compact={viewMode === 'compact'}
          selection={selection}
          selectionMode={selectionMode}
          onQuickEdit={setQuickEdit}
          onToggleSelect={(t) => toggleSelect(t.id)}
          empty={
            totalCount === 0 ? (
              <EmptyState
                icon="▦"
                title="Library masih kosong"
                description="Tambah judul satu per satu, atau impor dari file CSV/JSON/TXT di Settings."
                action={
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setAddOpen(true)}>
                      + Add Title
                    </Button>
                    <Link to="/settings">
                      <Button>Import</Button>
                    </Link>
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon="⌕"
                title="Tidak ada judul yang cocok"
                description="Coba ubah kata kunci atau bersihkan filter."
                action={<Button onClick={filter.clear}>Clear filter</Button>}
              />
            )
          }
        />
      )}

      <AdaptiveDialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter"
        size="md"
      >
        <FilterPanel resultCount={filtered.length} onApply={() => setFilterOpen(false)} />
      </AdaptiveDialog>

      <BulkActionBar />

      <AddTitleDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <QuickEditDialog
        title={quickEdit}
        open={quickEdit !== null}
        onClose={() => setQuickEdit(null)}
      />
    </>
  );
}
