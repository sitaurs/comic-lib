import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/**
 * Hook data reaktif — spec §8 L205 (useLiveQuery agar UI sinkron dengan IndexedDB).
 */

export function useTitles() {
  return useLiveQuery(() => db.titles.toArray(), [], undefined);
}

export function useTitle(id: string | undefined) {
  return useLiveQuery(() => (id ? db.titles.get(id) : undefined), [id], undefined);
}

/** Jumlah judul tanpa memuat seluruh record (dipakai header/statistik). */
export function useTitleCount() {
  return useLiveQuery(() => db.titles.count(), [], undefined);
}

export function useBadges() {
  return useLiveQuery(() => db.badges.toArray(), [], undefined);
}

export function useBadgeCategories() {
  return useLiveQuery(
    () => db.badgeCategories.orderBy('order').toArray(),
    [],
    undefined,
  );
}

export function useCollections() {
  return useLiveQuery(() => db.collections.toArray(), [], undefined);
}

/** titleId → Set<badgeId> — dipakai evaluasi filter (spec L185). */
export function useBadgeMap() {
  return useLiveQuery(async () => {
    const links = await db.titleBadges.toArray();
    const map = new Map<string, Set<string>>();
    for (const l of links) {
      const set = map.get(l.titleId);
      if (set) set.add(l.badgeId);
      else map.set(l.titleId, new Set([l.badgeId]));
    }
    return map;
  }, [], undefined);
}

/** badgeId → jumlah judul (usage count, req L44). */
export function useBadgeUsage() {
  return useLiveQuery(async () => {
    const links = await db.titleBadges.toArray();
    const counts = new Map<string, number>();
    for (const l of links) counts.set(l.badgeId, (counts.get(l.badgeId) ?? 0) + 1);
    return counts;
  }, [], undefined);
}

export function useTitleBadges(titleId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!titleId) return [];
      const links = await db.titleBadges.where('titleId').equals(titleId).toArray();
      const badges = await db.badges.bulkGet(links.map((l) => l.badgeId));
      return badges.filter((b): b is NonNullable<typeof b> => !!b);
    },
    [titleId],
    [],
  );
}

export function useCollectionMembers(collectionId: string | null) {
  return useLiveQuery(
    async () => {
      if (!collectionId) return null;
      const links = await db.titleCollections
        .where('collectionId')
        .equals(collectionId)
        .toArray();
      return new Set(links.map((l) => l.titleId));
    },
    [collectionId],
    null,
  );
}

export function useTitleCollections(titleId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!titleId) return [];
      const links = await db.titleCollections.where('titleId').equals(titleId).toArray();
      const cols = await db.collections.bulkGet(links.map((l) => l.collectionId));
      return cols.filter((c): c is NonNullable<typeof c> => !!c);
    },
    [titleId],
    [],
  );
}
