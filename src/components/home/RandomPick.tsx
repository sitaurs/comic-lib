import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Title } from '../../db/types';
import { useCoverUrl } from '../../hooks/useCoverUrl';
import { useCollectionMembers, useCollections } from '../../hooks/useLibraryData';
import { Button } from '../ui/Button';
import { Chip, ReadingStatusPill, TierChip } from '../ui/Chip';
import { AdaptiveDialog } from '../ui/Modal';

/**
 * Random Pick 🎲 — req FR-24 (L97–L98), design §5-1 & §6 (tombol dadu di mobile).
 * Lingkup: semua judul / belum baca / tier SS–S / dari collection tertentu.
 */
type ScopeKind = 'all' | 'unread' | 'top' | 'collection';

const SCOPE_LABELS: Record<ScopeKind, string> = {
  all: 'Semua judul',
  unread: 'Belum Baca',
  top: 'Tier SS–S',
  collection: 'Dari collection',
};

export function RandomPick({ titles }: { titles: Title[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} disabled={titles.length === 0}>
        <span aria-hidden>🎲</span> Random Pick
      </Button>
      <RandomPickDialog open={open} onClose={() => setOpen(false)} titles={titles} />
    </>
  );
}

function RandomPickDialog({
  open,
  onClose,
  titles,
}: {
  open: boolean;
  onClose: () => void;
  titles: Title[];
}) {
  const collections = useCollections();
  const [scope, setScope] = useState<ScopeKind>('all');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const members = useCollectionMembers(scope === 'collection' ? collectionId : null);
  // seed diubah tiap "Acak lagi" agar pilihan dihitung ulang
  const [seed, setSeed] = useState(0);

  const pool = useMemo(() => {
    switch (scope) {
      case 'unread':
        return titles.filter((t) => t.readingStatus === 'belum_baca');
      case 'top':
        return titles.filter((t) => t.tier === 'SS' || t.tier === 'S');
      case 'collection':
        return members ? titles.filter((t) => members.has(t.id)) : [];
      case 'all':
      default:
        return titles;
    }
  }, [titles, scope, members]);

  const picked = useMemo<Title | null>(() => {
    void seed; // seed hanya pemicu re-roll
    if (pool.length === 0) return null;
    // noUncheckedIndexedAccess: indeks pasti valid karena pool tidak kosong
    return pool[Math.floor(Math.random() * pool.length)]!;
  }, [pool, seed]);

  function selectScope(kind: ScopeKind) {
    setScope(kind);
    if (kind !== 'collection') setCollectionId(null);
    setSeed((s) => s + 1);
  }

  const scopeKinds: ScopeKind[] = ['all', 'unread', 'top', 'collection'];

  return (
    <AdaptiveDialog open={open} onClose={onClose} title="Random Pick 🎲" size="md">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs text-text-secondary">Lingkup</p>
          <div className="flex flex-wrap gap-2">
            {scopeKinds.map((kind) => (
              <Chip
                key={kind}
                active={scope === kind}
                onClick={() => selectScope(kind)}
                className="cursor-pointer"
              >
                {SCOPE_LABELS[kind]}
              </Chip>
            ))}
          </div>
        </div>

        {scope === 'collection' && (
          <label className="block">
            <span className="mb-1 block text-xs text-text-secondary">Collection</span>
            <select
              value={collectionId ?? ''}
              onChange={(e) => {
                setCollectionId(e.target.value || null);
                setSeed((s) => s + 1);
              }}
              className="w-full rounded-lg border border-hairline bg-bg/70 px-3 py-2 text-sm focus:border-brand/50"
            >
              <option value="">Pilih collection…</option>
              {(collections ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {picked ? (
          <PickResult title={picked} onClose={onClose} onAgain={() => setSeed((s) => s + 1)} />
        ) : (
          <p className="rounded-2xl border border-hairline bg-surface/50 px-4 py-10 text-center text-sm text-text-muted">
            {scope === 'collection' && !collectionId
              ? 'Pilih collection dulu.'
              : 'Tidak ada judul pada lingkup ini.'}
          </p>
        )}
      </div>
    </AdaptiveDialog>
  );
}

/** Hasil acak: kartu cover besar + judul + tier + aksi (design §5-1, §4). */
function PickResult({
  title,
  onClose,
  onAgain,
}: {
  title: Title;
  onClose: () => void;
  onAgain: () => void;
}) {
  const coverUrl = useCoverUrl(title.coverId);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface/50 p-4 sm:flex-row">
      <div className="mx-auto w-40 shrink-0 sm:mx-0">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-hairline bg-surface">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center px-2 text-center text-xs text-text-muted">
              Tanpa cover
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-xl font-bold leading-tight tracking-editorial">
          {title.title}
        </h3>
        {title.titleKo && <p className="mt-0.5 text-xs text-text-muted">{title.titleKo}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TierChip tier={title.tier} size="md" solid />
          <ReadingStatusPill status={title.readingStatus} />
          {title.favorite && (
            <span aria-label="Favorit" title="Favorit" className="text-sm text-brand">
              ♥
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/title/${title.id}`} onClick={onClose}>
            <Button variant="primary" size="sm">
              Buka detail →
            </Button>
          </Link>
          <Button size="sm" onClick={onAgain}>
            <span aria-hidden>🎲</span> Acak lagi
          </Button>
        </div>
      </div>
    </div>
  );
}
