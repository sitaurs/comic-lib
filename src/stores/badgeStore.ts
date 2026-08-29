import { create } from 'zustand';
import { db } from '../db/db';
import { ensureBadge, ensureCategory } from '../db/seed';
import { newId } from '../lib/id';

/**
 * badgeStore — spec §8 L202.
 * CRUD badge & kategori, merge, usage count (dari titleBadges) — req FR-06.
 */
interface BadgeActions {
  createCategory: (name: string) => Promise<string>;
  renameCategory: (id: string, name: string) => Promise<void>;
  /** Hapus kategori; badge di dalamnya dipindah ke kategori tujuan atau ikut terhapus. */
  deleteCategory: (id: string, moveBadgesTo?: string) => Promise<void>;

  createBadge: (name: string, categoryId: string) => Promise<string>;
  renameBadge: (id: string, name: string) => Promise<void>;
  moveBadge: (id: string, categoryId: string) => Promise<void>;
  /** Gabungkan keanggotaan `sourceId` ke `targetId` lalu hapus sumber (FR-06). */
  mergeBadges: (sourceId: string, targetId: string) => Promise<void>;
  /** Menghapus badge melepasnya dari semua judul (req L44). */
  deleteBadge: (id: string) => Promise<void>;

  attachBadge: (titleId: string, badgeId: string) => Promise<void>;
  detachBadge: (titleId: string, badgeId: string) => Promise<void>;
  toggleBadge: (titleId: string, badgeId: string) => Promise<void>;

  ensureCategoryByName: (name: string) => Promise<string>;
  ensureBadgeByName: (name: string, categoryId: string) => Promise<string>;
}

export const useBadgeStore = create<BadgeActions>(() => ({
  async createCategory(name) {
    const count = await db.badgeCategories.count();
    const id = newId();
    await db.badgeCategories.add({ id, name: name.trim(), order: count });
    return id;
  },

  async renameCategory(id, name) {
    await db.badgeCategories.update(id, { name: name.trim() });
  },

  async deleteCategory(id, moveBadgesTo) {
    await db.transaction('rw', db.badgeCategories, db.badges, db.titleBadges, async () => {
      const badges = await db.badges.where('categoryId').equals(id).toArray();
      if (moveBadgesTo) {
        await db.badges
          .where('categoryId')
          .equals(id)
          .modify({ categoryId: moveBadgesTo });
      } else {
        for (const b of badges) {
          await db.titleBadges.where('badgeId').equals(b.id).delete();
        }
        await db.badges.bulkDelete(badges.map((b) => b.id));
      }
      await db.badgeCategories.delete(id);
    });
  },

  async createBadge(name, categoryId) {
    const id = newId();
    await db.badges.add({ id, name: name.trim(), categoryId, createdAt: Date.now() });
    return id;
  },

  async renameBadge(id, name) {
    await db.badges.update(id, { name: name.trim() });
  },

  async moveBadge(id, categoryId) {
    await db.badges.update(id, { categoryId });
  },

  async mergeBadges(sourceId, targetId) {
    if (sourceId === targetId) return;
    await db.transaction('rw', db.badges, db.titleBadges, async () => {
      const links = await db.titleBadges.where('badgeId').equals(sourceId).toArray();
      // union keanggotaan: bulkPut mengabaikan duplikat karena PK gabungan
      await db.titleBadges.bulkPut(
        links.map((l) => ({ titleId: l.titleId, badgeId: targetId })),
      );
      await db.titleBadges.where('badgeId').equals(sourceId).delete();
      await db.badges.delete(sourceId);
    });
  },

  async deleteBadge(id) {
    await db.transaction('rw', db.badges, db.titleBadges, async () => {
      await db.titleBadges.where('badgeId').equals(id).delete();
      await db.badges.delete(id);
    });
  },

  async attachBadge(titleId, badgeId) {
    await db.titleBadges.put({ titleId, badgeId });
  },

  async detachBadge(titleId, badgeId) {
    await db.titleBadges.delete([titleId, badgeId]);
  },

  async toggleBadge(titleId, badgeId) {
    const existing = await db.titleBadges.get([titleId, badgeId]);
    if (existing) await db.titleBadges.delete([titleId, badgeId]);
    else await db.titleBadges.put({ titleId, badgeId });
  },

  ensureCategoryByName: ensureCategory,
  ensureBadgeByName: ensureBadge,
}));

/** Usage count per badge — req L44, dihitung dari tabel join (spec L80). */
export async function getBadgeUsageCounts(): Promise<Map<string, number>> {
  const links = await db.titleBadges.toArray();
  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.badgeId, (counts.get(l.badgeId) ?? 0) + 1);
  return counts;
}
