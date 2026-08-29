import { useState } from 'react';
import { db } from '../db/db';
import type { Collection } from '../db/types';
import { newId } from '../lib/id';
import { PageHeader, EmptyState } from '../components/layout/PageHeader';
import { Button, IconButton } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CoverCard } from '../components/library/CoverCard';
import { useCollections, useTitles } from '../hooks/useLibraryData';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUIStore } from '../stores/uiStore';

/**
 * Collections — req FR-19 (L82–L83), spec L25/L70.
 * Keanggotaan many-to-many lewat tabel join `titleCollections` (judul tidak
 * menyimpan array collection). CRUD + kelola anggota.
 */
export function CollectionsPage() {
  const collections = useCollections();
  const toast = useUIStore((s) => s.toast);
  const [editing, setEditing] = useState<Collection | 'new' | null>(null);
  const [manage, setManage] = useState<Collection | null>(null);

  const counts = useLiveQuery(async () => {
    const links = await db.titleCollections.toArray();
    const map = new Map<string, number>();
    for (const l of links) map.set(l.collectionId, (map.get(l.collectionId) ?? 0) + 1);
    return map;
  }, [], undefined);

  async function remove(collection: Collection) {
    await db.transaction('rw', db.collections, db.titleCollections, async () => {
      await db.titleCollections.where('collectionId').equals(collection.id).delete();
      await db.collections.delete(collection.id);
    });
    toast(`Collection "${collection.name}" dihapus`, 'success');
  }

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle={collections ? `${collections.length} collection` : 'Memuat…'}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            + New Collection
          </Button>
        }
      />

      {collections === undefined ? (
        <p className="py-16 text-center text-sm text-text-muted">Memuat…</p>
      ) : collections.length === 0 ? (
        <EmptyState
          icon="❐"
          title="Belum ada collection"
          description="Kelompokkan judul secara bebas, mis. “Wajib Baca Ulang” atau “Rekomendasi Teman”."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              + New Collection
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <article
              key={c.id}
              className="rounded-2xl border border-hairline bg-surface/50 p-4 transition-colors duration-fast hover:border-hairline/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-semibold tracking-editorial">
                    {c.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {counts?.get(c.id) ?? 0} judul
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`Ubah ${c.name}`} onClick={() => setEditing(c)}>
                    ✎
                  </IconButton>
                  <IconButton label={`Hapus ${c.name}`} onClick={() => void remove(c)}>
                    🗑
                  </IconButton>
                </div>
              </div>

              {c.description && (
                <p className="mt-2 line-clamp-2 text-xs text-text-secondary">{c.description}</p>
              )}

              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setManage(c)}>
                  Kelola judul
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <CollectionFormDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={(name, isNew) =>
          toast(isNew ? `Collection "${name}" dibuat` : `Collection "${name}" disimpan`, 'success')
        }
      />
      <ManageMembersDialog collection={manage} onClose={() => setManage(null)} />
    </>
  );
}

function CollectionFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: Collection | 'new' | null;
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}) {
  const isNew = value === 'new';
  const existing = value && value !== 'new' ? value : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [key, setKey] = useState('');

  // sinkronkan form saat dialog dibuka untuk entri berbeda
  const currentKey = existing?.id ?? (isNew ? 'new' : '');
  if (value !== null && key !== currentKey) {
    setKey(currentKey);
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existing) {
      await db.collections.update(existing.id, { name: trimmed, description: description.trim() });
    } else {
      await db.collections.add({
        id: newId(),
        name: trimmed,
        description: description.trim(),
        createdAt: Date.now(),
      });
    }
    onSaved(trimmed, !existing);
    onClose();
  }

  return (
    <Modal
      open={value !== null}
      onClose={onClose}
      title={existing ? 'Ubah Collection' : 'New Collection'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim()}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-text-secondary">Nama</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-hairline bg-bg/70 px-3 py-2 text-sm focus:border-brand/50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-secondary">Deskripsi (opsional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-hairline bg-bg/70 px-3 py-2 text-sm focus:border-brand/50"
          />
        </label>
      </div>
    </Modal>
  );
}

function ManageMembersDialog({
  collection,
  onClose,
}: {
  collection: Collection | null;
  onClose: () => void;
}) {
  const titles = useTitles();
  const [query, setQuery] = useState('');
  const members = useLiveQuery(
    async () => {
      if (!collection) return new Set<string>();
      const links = await db.titleCollections
        .where('collectionId')
        .equals(collection.id)
        .toArray();
      return new Set(links.map((l) => l.titleId));
    },
    [collection?.id],
    new Set<string>(),
  );

  async function toggle(titleId: string) {
    if (!collection) return;
    const key: [string, string] = [titleId, collection.id];
    const existing = await db.titleCollections.get(key);
    if (existing) await db.titleCollections.delete(key);
    else await db.titleCollections.put({ titleId, collectionId: collection.id });
  }

  const needle = query.trim().toLowerCase();
  const list = (titles ?? [])
    .filter((t) => !needle || t.title.toLowerCase().includes(needle))
    .sort((a, b) => {
      const am = members?.has(a.id) ? 0 : 1;
      const bm = members?.has(b.id) ? 0 : 1;
      return am - bm || a.title.localeCompare(b.title, 'id');
    })
    .slice(0, 120);

  return (
    <Modal
      open={collection !== null}
      onClose={onClose}
      title={collection ? `Judul di "${collection.name}"` : ''}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Selesai
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul…"
            aria-label="Cari judul"
            className="flex-1 rounded-lg border border-hairline bg-bg/70 px-3 py-2 text-sm focus:border-brand/50"
          />
          <span className="shrink-0 text-xs text-text-muted">{members?.size ?? 0} terpilih</span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {list.map((t) => {
            const active = members?.has(t.id) ?? false;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => void toggle(t.id)}
                aria-pressed={active}
                className={`rounded-xl p-1 text-left transition-colors duration-fast ${
                  active ? 'bg-brand/15 ring-1 ring-brand/50' : 'hover:bg-elevated'
                }`}
              >
                <div className="pointer-events-none">
                  <CoverCard title={t} compact />
                </div>
              </button>
            );
          })}
        </div>

        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">Tidak ada judul yang cocok.</p>
        )}
      </div>
    </Modal>
  );
}
