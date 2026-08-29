import { useState } from 'react';
import type { Tier } from '../../db/types';
import { TIER_ORDER } from '../../design/tokens';
import { useBadgeCategories, useBadges, useCollections } from '../../hooks/useLibraryData';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUIStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';
import { TierChip } from '../ui/Chip';
import { AdaptiveDialog } from '../ui/Modal';

/**
 * Bulk Edit — req FR-18 (L79–L80) + design §6 "Action Bar N Selected".
 * Bar mengambang (glass) di bawah; di mobile duduk di atas bottom nav.
 * Aksi: mark read/unread · set tier · favorit · add badge · add to collection · hapus.
 */
type SubMenu = 'tier' | 'badge' | 'collection' | null;

export function BulkActionBar() {
  const selection = useUIStore((s) => s.selection);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const toast = useUIStore((s) => s.toast);
  const lib = useLibraryStore();
  const [menu, setMenu] = useState<SubMenu>(null);

  const ids = [...selection];
  if (ids.length === 0) return null;

  const n = ids.length;
  const done = (message: string) => {
    toast(message, 'success');
    setMenu(null);
  };

  return (
    <>
      {/* bottom-20 di mobile agar tidak menutupi bottom nav (design §6) */}
      <div className="fixed inset-x-0 bottom-20 z-40 px-3 md:bottom-4">
        <div className="glass mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
          <span className="mr-1 text-sm font-semibold text-text-primary">{n} Selected</span>

          <Button
            size="sm"
            onClick={async () => {
              await lib.bulkSetReadingStatus(ids, 'pernah_baca');
              done(`${n} judul ditandai Pernah Baca`);
            }}
          >
            ✓ Mark read
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await lib.bulkSetReadingStatus(ids, 'belum_baca');
              done(`${n} judul ditandai Belum Baca`);
            }}
          >
            ○ Mark unread
          </Button>
          <Button size="sm" onClick={() => setMenu('tier')}>
            Set tier
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await lib.bulkSetFavorite(ids, true);
              done(`${n} judul jadi favorit`);
            }}
          >
            ♥ Favorite
          </Button>
          <Button size="sm" onClick={() => setMenu('badge')}>
            + Badge
          </Button>
          <Button size="sm" onClick={() => setMenu('collection')}>
            + Collection
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              await lib.bulkDelete(ids);
              clearSelection();
              toast(`${n} judul dihapus`, 'success');
            }}
          >
            Hapus
          </Button>

          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            Batal
          </Button>
        </div>
      </div>

      <AdaptiveDialog
        open={menu === 'tier'}
        onClose={() => setMenu(null)}
        title={`Set tier untuk ${n} judul`}
        size="sm"
      >
        <div className="flex flex-wrap gap-2">
          {TIER_ORDER.map((tier: Tier) => (
            <button
              key={tier}
              type="button"
              onClick={async () => {
                await lib.bulkSetTier(ids, tier);
                done(`${n} judul jadi tier ${tier}`);
              }}
              className="rounded-full border border-hairline p-1 transition-colors duration-fast hover:border-brand/60"
            >
              <TierChip tier={tier} size="md" solid />
            </button>
          ))}
        </div>
      </AdaptiveDialog>

      <BulkBadgeDialog
        open={menu === 'badge'}
        onClose={() => setMenu(null)}
        count={n}
        onPick={async (badgeId, name) => {
          await lib.bulkAddBadge(ids, badgeId);
          done(`Badge "${name}" dipasang ke ${n} judul`);
        }}
      />

      <BulkCollectionDialog
        open={menu === 'collection'}
        onClose={() => setMenu(null)}
        count={n}
        onPick={async (collectionId, name) => {
          await lib.bulkAddToCollection(ids, collectionId);
          done(`${n} judul masuk "${name}"`);
        }}
      />
    </>
  );
}

function BulkBadgeDialog({
  open,
  onClose,
  count,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onPick: (badgeId: string, name: string) => void | Promise<void>;
}) {
  const badges = useBadges();
  const categories = useBadgeCategories();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  return (
    <AdaptiveDialog open={open} onClose={onClose} title={`Tambah badge ke ${count} judul`} size="md">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari badge…"
        aria-label="Cari badge"
        className="mb-3 w-full rounded-lg border border-hairline bg-bg/70 px-3 py-2 text-sm focus:border-brand/50"
      />
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {(categories ?? []).map((cat) => {
          const items = (badges ?? [])
            .filter((b) => b.categoryId === cat.id)
            .filter((b) => !needle || b.name.toLowerCase().includes(needle));
          if (items.length === 0) return null;
          return (
            <div key={cat.id}>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-text-muted">{cat.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => void onPick(b.id, b.name)}
                    className="rounded-full border border-hairline bg-elevated px-2.5 py-1 text-xs text-text-secondary transition-colors duration-fast hover:text-text-primary"
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {(badges?.length ?? 0) === 0 && (
          <p className="text-sm text-text-muted">Belum ada badge — buat dulu di Badge Manager.</p>
        )}
      </div>
    </AdaptiveDialog>
  );
}

function BulkCollectionDialog({
  open,
  onClose,
  count,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onPick: (collectionId: string, name: string) => void | Promise<void>;
}) {
  const collections = useCollections();

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title={`Tambah ${count} judul ke collection`}
      size="sm"
    >
      {(collections?.length ?? 0) === 0 ? (
        <p className="text-sm text-text-muted">
          Belum ada collection — buat dulu di halaman Collections.
        </p>
      ) : (
        <div className="space-y-1.5">
          {(collections ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void onPick(c.id, c.name)}
              className="w-full rounded-xl border border-hairline bg-elevated px-3 py-2 text-left text-sm transition-colors duration-fast hover:border-brand/50"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </AdaptiveDialog>
  );
}
