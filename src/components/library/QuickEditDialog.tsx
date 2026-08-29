import { useState } from 'react';
import type { Badge, Title } from '../../db/types';
import { TIER_ORDER } from '../../design/tokens';
import { useBadgeCategories, useBadges, useTitleBadges } from '../../hooks/useLibraryData';
import { useBadgeStore } from '../../stores/badgeStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUIStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';
import { Chip, TierChip } from '../ui/Chip';
import { AdaptiveDialog } from '../ui/Modal';

/**
 * Quick Edit — req FR-21, design §5-7.
 * Ubah status baca, tier, favorit, badge tanpa membuka detail.
 * Perubahan langsung tersimpan + toast konfirmasi (design §8).
 */
export function QuickEditDialog({
  title,
  open,
  onClose,
}: {
  title: Title | null;
  open: boolean;
  onClose: () => void;
}) {
  const badges = useBadges();
  const categories = useBadgeCategories();
  const attached = useTitleBadges(title?.id);
  const [query, setQuery] = useState('');
  const [newBadgeCat, setNewBadgeCat] = useState<string>('');

  const { setTier, toggleFavorite, setReadingStatus } = useLibraryStore();
  const { toggleBadge, createBadge } = useBadgeStore();
  const toast = useUIStore((s) => s.toast);

  if (!title) return null;

  const attachedIds = new Set(attached.map((b) => b.id));
  const q = query.trim().toLowerCase();
  const filtered = (badges ?? []).filter((b) => !q || b.name.toLowerCase().includes(q));
  const byCat = new Map<string, Badge[]>();
  for (const b of filtered) {
    const list = byCat.get(b.categoryId);
    if (list) list.push(b);
    else byCat.set(b.categoryId, [b]);
  }

  const exactExists = filtered.some((b) => b.name.toLowerCase() === q);
  const firstCatId = categories?.[0]?.id ?? '';

  /** Buat badge baru langsung dari selektor — req FR-07. */
  const createInline = async () => {
    const name = query.trim();
    if (!name) return;
    const catId = newBadgeCat || firstCatId;
    if (!catId) {
      toast('Buat kategori dulu di halaman Badges', 'error');
      return;
    }
    const id = await createBadge(name, catId);
    await toggleBadge(title.id, id);
    setQuery('');
    toast(`Badge "${name}" dibuat & dipasang`, 'success');
  };

  return (
    <AdaptiveDialog open={open} onClose={onClose} title={title.title} size="md">
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Status baca</p>
          <div className="flex gap-2">
            {(['belum_baca', 'pernah_baca'] as const).map((s) => (
              <Chip
                key={s}
                active={title.readingStatus === s}
                onClick={async () => {
                  await setReadingStatus(title.id, s);
                  toast(`Status: ${s === 'pernah_baca' ? 'Pernah Baca' : 'Belum Baca'}`);
                }}
              >
                {s === 'pernah_baca' ? '✓ Pernah Baca' : '○ Belum Baca'}
              </Chip>
            ))}
            <Chip
              active={title.favorite}
              onClick={async () => {
                await toggleFavorite(title.id);
                toast(title.favorite ? 'Dilepas dari favorit' : 'Ditandai favorit');
              }}
            >
              ♥ Favorit
            </Chip>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Tier</p>
          <div className="flex flex-wrap gap-1.5">
            {TIER_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={async () => {
                  await setTier(title.id, t);
                  toast(`Tier di-set ${t}`);
                }}
              >
                <TierChip
                  tier={t}
                  solid={title.tier === t}
                  size="md"
                  className={title.tier === t ? '' : 'opacity-60'}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Badge</p>
          <input
            className="mb-2 w-full rounded-xl border border-hairline bg-bg px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari atau buat badge…"
          />

          {q && !exactExists && (
            <div className="mb-2 flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={createInline}>
                + Buat "{query.trim()}"
              </Button>
              {(categories?.length ?? 0) > 1 && (
                <select
                  className="rounded-lg border border-hairline bg-bg px-2 py-1.5 text-xs"
                  value={newBadgeCat || firstCatId}
                  onChange={(e) => setNewBadgeCat(e.target.value)}
                >
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="max-h-60 space-y-3 overflow-y-auto rounded-xl border border-hairline bg-bg/50 p-3">
            {(categories ?? []).map((cat) => {
              const list = byCat.get(cat.id) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={cat.id}>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-text-muted">
                    {cat.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((b) => (
                      <Chip
                        key={b.id}
                        active={attachedIds.has(b.id)}
                        onClick={() => void toggleBadge(title.id, b.id)}
                      >
                        {b.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-text-muted">Tidak ada badge yang cocok.</p>
            )}
          </div>
        </div>
      </div>
    </AdaptiveDialog>
  );
}
