import { db } from '../db/db';
import { newId } from './id';

/**
 * Cache objectURL cover — spec L82 (todos 1.11).
 * UI render via URL.createObjectURL(blob); URL di-cache per coverId dan
 * di-revoke saat entri dibuang/diganti agar tidak leak memori.
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export async function getCoverUrl(coverId: string | null): Promise<string | null> {
  if (!coverId) return null;

  const hit = cache.get(coverId);
  if (hit) return hit;

  const inflight = pending.get(coverId);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const cover = await db.covers.get(coverId);
      if (!cover) return null;
      // Cek ulang: request paralel lain bisa sudah mengisi cache.
      const existing = cache.get(coverId);
      if (existing) return existing;
      const url = URL.createObjectURL(cover.blob);
      cache.set(coverId, url);
      return url;
    } finally {
      pending.delete(coverId);
    }
  })();

  pending.set(coverId, task);
  return task;
}

/** Lepas satu entri (mis. cover diganti atau judul dihapus). */
export function revokeCoverUrl(coverId: string): void {
  const url = cache.get(coverId);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(coverId);
  }
}

/** Lepas semua — dipakai saat restore/wipe database. */
export function revokeAllCoverUrls(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}

/** Simpan Blob cover baru; mengembalikan coverId. */
export async function putCover(blob: Blob, mime = blob.type || 'image/jpeg'): Promise<string> {
  const id = newId();
  await db.covers.add({ id, blob, mime });
  return id;
}

/** Ganti cover sebuah judul (hapus blob lama + revoke URL-nya). */
export async function replaceCover(
  titleId: string,
  blob: Blob,
  mime = blob.type || 'image/jpeg',
): Promise<string> {
  const title = await db.titles.get(titleId);
  const newCoverId = newId();
  await db.transaction('rw', db.titles, db.covers, async () => {
    await db.covers.add({ id: newCoverId, blob, mime });
    await db.titles.update(titleId, { coverId: newCoverId, updatedAt: Date.now() });
    if (title?.coverId) await db.covers.delete(title.coverId);
  });
  if (title?.coverId) revokeCoverUrl(title.coverId);
  return newCoverId;
}
