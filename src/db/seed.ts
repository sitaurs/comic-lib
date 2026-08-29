import { db } from './db';
import { newId } from '../lib/id';

/**
 * Seed kategori badge default — spec L136, req L50 (FR-08).
 * Kategori "Genre" & "Tema" dibuat otomatis; idempoten (aman dipanggil tiap boot).
 */
export const DEFAULT_CATEGORIES = ['Genre', 'Tema'] as const;
export type DefaultCategoryName = (typeof DEFAULT_CATEGORIES)[number];

export async function seedDefaultCategories(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  await db.transaction('rw', db.badgeCategories, async () => {
    const existing = await db.badgeCategories.toArray();
    for (const cat of existing) map[cat.name] = cat.id;

    let order = existing.length;
    for (const name of DEFAULT_CATEGORIES) {
      if (map[name]) continue;
      const id = newId();
      await db.badgeCategories.add({ id, name, order: order++ });
      map[name] = id;
    }
  });
  return map;
}

/** Ambil (atau buat) kategori berdasarkan nama — dipakai importer & Badge Manager. */
export async function ensureCategory(name: string): Promise<string> {
  const trimmed = name.trim();
  const found = await db.badgeCategories.where('name').equals(trimmed).first();
  if (found) return found.id;
  const count = await db.badgeCategories.count();
  const id = newId();
  await db.badgeCategories.add({ id, name: trimmed, order: count });
  return id;
}

/** Ambil (atau buat) badge dalam satu kategori — dipakai import genre/tema (spec L120). */
export async function ensureBadge(name: string, categoryId: string): Promise<string> {
  const trimmed = name.trim();
  const candidates = await db.badges.where('name').equals(trimmed).toArray();
  const found = candidates.find((b) => b.categoryId === categoryId);
  if (found) return found.id;
  const id = newId();
  await db.badges.add({ id, name: trimmed, categoryId, createdAt: Date.now() });
  return id;
}

/** Persist storage — req NFR-04 (L120). Dipanggil sekali saat boot. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
