import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Badge } from '../db/types';
import { PageHeader, EmptyState } from '../components/layout/PageHeader';
import { Button, IconButton } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useBadgeCategories, useBadges, useBadgeUsage } from '../hooks/useLibraryData';
import { useBadgeStore } from '../stores/badgeStore';
import { useFilterStore } from '../stores/filterStore';
import { useUIStore } from '../stores/uiStore';

/**
 * Badge Manager — req FR-06 & FR-08, design §5-6.
 * Kategori berisi badge + usage count; menu per badge: Rename / Move / Merge / Delete.
 */
type Action =
  | { kind: 'rename'; badge: Badge }
  | { kind: 'move'; badge: Badge }
  | { kind: 'merge'; badge: Badge }
  | { kind: 'newCategory' }
  | { kind: 'renameCategory'; id: string; name: string }
  | { kind: 'newBadge'; categoryId: string }
  | null;

export function BadgesPage() {
  const categories = useBadgeCategories();
  const badges = useBadges();
  const usage = useBadgeUsage();
  const store = useBadgeStore();
  const toast = useUIStore((s) => s.toast);
  const filterByBadge = useFilterStore((s) => s.filterByBadge);
  const navigate = useNavigate();

  const [action, setAction] = useState<Action>(null);
  const [text, setText] = useState('');
  const [targetId, setTargetId] = useState('');
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Badge[]>();
    for (const b of badges ?? []) {
      if (q && !b.name.toLowerCase().includes(q)) continue;
      const list = map.get(b.categoryId);
      if (list) list.push(b);
      else map.set(b.categoryId, [b]);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    return map;
  }, [badges, query]);

  const openAction = (a: Action, initial = '') => {
    setAction(a);
    setText(initial);
    setTargetId('');
  };

  const submit = async () => {
    if (!action) return;
    const name = text.trim();
    try {
      switch (action.kind) {
        case 'rename':
          if (!name) return;
          await store.renameBadge(action.badge.id, name);
          toast('Badge di-rename', 'success');
          break;
        case 'move':
          if (!targetId) return;
          await store.moveBadge(action.badge.id, targetId);
          toast('Badge dipindah', 'success');
          break;
        case 'merge': {
          if (!targetId) return;
          const target = badges?.find((b) => b.id === targetId);
          await store.mergeBadges(action.badge.id, targetId);
          toast(`"${action.badge.name}" digabung ke "${target?.name ?? '—'}"`, 'success');
          break;
        }
        case 'newCategory':
          if (!name) return;
          await store.createCategory(name);
          toast('Kategori dibuat', 'success');
          break;
        case 'renameCategory':
          if (!name) return;
          await store.renameCategory(action.id, name);
          toast('Kategori di-rename', 'success');
          break;
        case 'newBadge':
          if (!name) return;
          await store.createBadge(name, action.categoryId);
          toast('Badge dibuat', 'success');
          break;
      }
      setAction(null);
    } catch (err) {
      console.error(err);
      toast('Aksi gagal', 'error');
    }
  };

  const deleteBadge = async (b: Badge) => {
    const count = usage?.get(b.id) ?? 0;
    const msg =
      count > 0
        ? `Hapus badge "${b.name}"? Badge ini akan dilepas dari ${count} judul.`
        : `Hapus badge "${b.name}"?`;
    if (!window.confirm(msg)) return;
    await store.deleteBadge(b.id);
    toast('Badge dihapus');
  };

  const deleteCategory = async (id: string, name: string) => {
    const inCat = (badges ?? []).filter((b) => b.categoryId === id);
    const msg =
      inCat.length > 0
        ? `Hapus kategori "${name}" beserta ${inCat.length} badge di dalamnya? Badge akan dilepas dari semua judul.`
        : `Hapus kategori "${name}"?`;
    if (!window.confirm(msg)) return;
    await store.deleteCategory(id);
    toast('Kategori dihapus');
  };

  const loading = categories === undefined || badges === undefined;

  return (
    <>
      <PageHeader
        title="Badges"
        subtitle={loading ? 'Memuat…' : `${badges?.length ?? 0} badge · ${categories?.length ?? 0} kategori`}
        actions={
          <Button variant="primary" onClick={() => openAction({ kind: 'newCategory' })}>
            + Kategori
          </Button>
        }
      />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari badge…"
        aria-label="Cari badge"
        className="mb-4 w-full rounded-xl border border-hairline bg-bg px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand/50 md:max-w-sm"
      />

      {loading ? (
        <p className="py-16 text-center text-sm text-text-muted">Memuat…</p>
      ) : (categories?.length ?? 0) === 0 ? (
        <EmptyState
          icon="◈"
          title="Belum ada kategori"
          description='Kategori "Genre" & "Tema" biasanya dibuat otomatis. Buat kategori baru untuk mulai menandai judul.'
          action={
            <Button variant="primary" onClick={() => openAction({ kind: 'newCategory' })}>
              + Kategori
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {(categories ?? []).map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            return (
              <section
                key={cat.id}
                className="rounded-2xl border border-hairline bg-surface/60 p-4"
              >
                <header className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold tracking-editorial">
                    {cat.name}{' '}
                    <span className="ml-1 text-xs font-normal text-text-muted">
                      {list.length} badge
                    </span>
                  </h2>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={() => openAction({ kind: 'newBadge', categoryId: cat.id })}
                    >
                      + Badge
                    </Button>
                    <IconButton
                      label={`Rename kategori ${cat.name}`}
                      onClick={() =>
                        openAction({ kind: 'renameCategory', id: cat.id, name: cat.name }, cat.name)
                      }
                    >
                      ✎
                    </IconButton>
                    <IconButton
                      label={`Hapus kategori ${cat.name}`}
                      onClick={() => void deleteCategory(cat.id, cat.name)}
                    >
                      ×
                    </IconButton>
                  </div>
                </header>

                {list.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    {query ? 'Tidak ada badge yang cocok.' : 'Belum ada badge di kategori ini.'}
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {list.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center gap-1 rounded-full border border-hairline bg-elevated pl-1 pr-1"
                      >
                        {/* klik badge → filter library (req FR-11) */}
                        <button
                          type="button"
                          onClick={() => {
                            filterByBadge(b.id);
                            navigate('/library');
                          }}
                          className="rounded-full px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                          title="Filter library dengan badge ini"
                        >
                          {b.name}
                          <span className="ml-1.5 tabular-nums text-text-muted">
                            {usage?.get(b.id) ?? 0}
                          </span>
                        </button>
                        <BadgeMenu
                          onRename={() => openAction({ kind: 'rename', badge: b }, b.name)}
                          onMove={() => openAction({ kind: 'move', badge: b })}
                          onMerge={() => openAction({ kind: 'merge', badge: b })}
                          onDelete={() => void deleteBadge(b)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* dialog aksi */}
      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          action?.kind === 'rename'
            ? 'Rename badge'
            : action?.kind === 'move'
              ? 'Pindah kategori'
              : action?.kind === 'merge'
                ? 'Merge badge'
                : action?.kind === 'newCategory'
                  ? 'Kategori baru'
                  : action?.kind === 'renameCategory'
                    ? 'Rename kategori'
                    : 'Badge baru'
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Batal
            </Button>
            <Button variant="primary" onClick={submit}>
              Simpan
            </Button>
          </>
        }
      >
        {(action?.kind === 'rename' ||
          action?.kind === 'newCategory' ||
          action?.kind === 'renameCategory' ||
          action?.kind === 'newBadge') && (
          <input
            autoFocus
            className="w-full rounded-xl border border-hairline bg-bg px-3 py-2 text-sm focus:border-brand/50"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="Nama…"
          />
        )}

        {action?.kind === 'move' && (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              Pindahkan <strong className="text-text-primary">{action.badge.name}</strong> ke:
            </p>
            <select
              className="w-full rounded-xl border border-hairline bg-bg px-3 py-2 text-sm"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Pilih kategori…</option>
              {(categories ?? [])
                .filter((c) => c.id !== action.badge.categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {action?.kind === 'merge' && (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              Gabungkan <strong className="text-text-primary">{action.badge.name}</strong> ke badge
              tujuan. Keanggotaan digabung, lalu badge ini dihapus.
            </p>
            <select
              className="w-full rounded-xl border border-hairline bg-bg px-3 py-2 text-sm"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Pilih badge tujuan…</option>
              {(badges ?? [])
                .filter((b) => b.id !== action.badge.id)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({usage?.get(b.id) ?? 0})
                  </option>
                ))}
            </select>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Menu ••• per badge — design §5-6. */
function BadgeMenu({
  onRename,
  onMove,
  onMerge,
  onDelete,
}: {
  onRename: () => void;
  onMove: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative">
      <button
        type="button"
        aria-label="Menu badge"
        onClick={() => setOpen((v) => !v)}
        className="grid h-6 w-6 place-items-center rounded-full text-text-muted hover:bg-bg/60 hover:text-text-primary"
      >
        •••
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <span className="glass absolute right-0 top-7 z-50 flex w-36 flex-col overflow-hidden rounded-xl py-1 text-left">
            {[
              ['Rename', onRename],
              ['Move', onMove],
              ['Merge', onMerge],
              ['Delete', onDelete],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => {
                  setOpen(false);
                  (fn as () => void)();
                }}
                className={`px-3 py-1.5 text-left text-xs hover:bg-elevated ${
                  label === 'Delete' ? 'text-tier-d' : 'text-text-secondary'
                }`}
              >
                {label as string}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
