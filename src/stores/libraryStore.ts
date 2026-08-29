import { create } from 'zustand';
import { db } from '../db/db';
import { emptyTitle, type ReadingStatus, type Tier, type Title } from '../db/types';
import { newId } from '../lib/id';
import { revokeCoverUrl } from '../lib/coverCache';

/**
 * libraryStore — spec §8 L200.
 * Daftar judul dibaca reaktif lewat `useLiveQuery` di komponen; store ini
 * memegang aksi CRUD/toggle/bulk edit (bukan salinan data).
 */
interface LibraryActions {
  addTitle: (patch: Partial<Title>) => Promise<string>;
  updateTitle: (id: string, patch: Partial<Title>) => Promise<void>;
  deleteTitle: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setReadingStatus: (id: string, status: ReadingStatus) => Promise<void>;
  toggleReadingStatus: (id: string) => Promise<void>;
  setTier: (id: string, tier: Tier) => Promise<void>;
  // bulk edit — req FR-18
  bulkSetReadingStatus: (ids: string[], status: ReadingStatus) => Promise<void>;
  bulkSetTier: (ids: string[], tier: Tier) => Promise<void>;
  bulkSetFavorite: (ids: string[], favorite: boolean) => Promise<void>;
  bulkAddBadge: (ids: string[], badgeId: string) => Promise<void>;
  bulkAddToCollection: (ids: string[], collectionId: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
}

const touch = () => ({ updatedAt: Date.now() });

export const useLibraryStore = create<LibraryActions>(() => ({
  async addTitle(patch) {
    const id = patch.id ?? newId();
    const record: Title = { ...emptyTitle(id), ...patch, id };
    await db.titles.add(record);
    return id;
  },

  async updateTitle(id, patch) {
    await db.titles.update(id, { ...patch, ...touch() });
  },

  async deleteTitle(id) {
    const title = await db.titles.get(id);
    await db.transaction(
      'rw',
      db.titles,
      db.titleBadges,
      db.titleCollections,
      db.covers,
      async () => {
        await db.titleBadges.where('titleId').equals(id).delete();
        await db.titleCollections.where('titleId').equals(id).delete();
        if (title?.coverId) await db.covers.delete(title.coverId);
        await db.titles.delete(id);
      },
    );
    if (title?.coverId) revokeCoverUrl(title.coverId);
  },

  async toggleFavorite(id) {
    const t = await db.titles.get(id);
    if (!t) return;
    await db.titles.update(id, { favorite: !t.favorite, ...touch() });
  },

  async setReadingStatus(id, readingStatus) {
    await db.titles.update(id, { readingStatus, ...touch() });
  },

  async toggleReadingStatus(id) {
    const t = await db.titles.get(id);
    if (!t) return;
    await db.titles.update(id, {
      readingStatus: t.readingStatus === 'pernah_baca' ? 'belum_baca' : 'pernah_baca',
      ...touch(),
    });
  },

  async setTier(id, tier) {
    await db.titles.update(id, { tier, ...touch() });
  },

  async bulkSetReadingStatus(ids, readingStatus) {
    await db.titles.where('id').anyOf(ids).modify({ readingStatus, ...touch() });
  },

  async bulkSetTier(ids, tier) {
    await db.titles.where('id').anyOf(ids).modify({ tier, ...touch() });
  },

  async bulkSetFavorite(ids, favorite) {
    await db.titles.where('id').anyOf(ids).modify({ favorite, ...touch() });
  },

  async bulkAddBadge(ids, badgeId) {
    await db.titleBadges.bulkPut(ids.map((titleId) => ({ titleId, badgeId })));
  },

  async bulkAddToCollection(ids, collectionId) {
    await db.titleCollections.bulkPut(ids.map((titleId) => ({ titleId, collectionId })));
  },

  async bulkDelete(ids) {
    const titles = await db.titles.where('id').anyOf(ids).toArray();
    const coverIds = titles.map((t) => t.coverId).filter((c): c is string => !!c);
    await db.transaction(
      'rw',
      db.titles,
      db.titleBadges,
      db.titleCollections,
      db.covers,
      async () => {
        await db.titleBadges.where('titleId').anyOf(ids).delete();
        await db.titleCollections.where('titleId').anyOf(ids).delete();
        await db.covers.bulkDelete(coverIds);
        await db.titles.bulkDelete(ids);
      },
    );
    coverIds.forEach(revokeCoverUrl);
  },
}));
