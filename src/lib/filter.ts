import type { Title } from '../db/types';
import { TIER_ORDER } from '../design/tokens';
import type { FilterState } from '../stores/filterStore';
import { normalizeKey } from './id';

/**
 * Evaluasi filter — spec §6 L183–L189.
 * `badgeMap` = titleId → Set<badgeId>, dibangun dari tabel join titleBadges.
 */
export interface FilterInput {
  titles: Title[];
  badgeMap: Map<string, Set<string>>;
  collectionMembers?: Set<string> | null;
}

const TIER_RANK = new Map(TIER_ORDER.map((t, i) => [t, i]));

/** Search mencakup judul + judul Korea + altTitles — spec L189, req FR-01. */
function matchesSearch(t: Title, needle: string): boolean {
  if (!needle) return true;
  const haystack = [t.title, t.titleKo ?? '', ...t.altTitles].map(normalizeKey);
  return haystack.some((h) => h.includes(needle));
}

/** Jumlah chapter yang dipakai untuk filter/sort: total sumber, fallback ke Indo. */
export function chapterCount(t: Title): number | null {
  return t.totalChapters ?? t.indoChapters;
}

export function applyFilter(
  { titles, badgeMap, collectionMembers }: FilterInput,
  f: FilterState,
): Title[] {
  const needle = normalizeKey(f.search);
  const hasBadgeInclude = f.badgeInclude.size > 0;
  const hasBadgeExclude = f.badgeExclude.size > 0;
  const hasChapterRange = f.chapterMin !== null || f.chapterMax !== null;

  const result = titles.filter((t) => {
    // filter murah lebih dulu (spec L184)
    if (f.readingStatus.size > 0 && !f.readingStatus.has(t.readingStatus)) return false;
    if (f.tiers.size > 0 && !f.tiers.has(t.tier)) return false;
    if (f.favoriteOnly && !t.favorite) return false;
    if (f.workStatus.size > 0 && !f.workStatus.has(t.workStatus)) return false;
    if (collectionMembers && !collectionMembers.has(t.id)) return false;

    if (hasChapterRange) {
      const n = chapterCount(t);
      // judul tanpa data chapter tidak bisa memenuhi rentang apa pun
      if (n === null) return false;
      if (f.chapterMin !== null && n < f.chapterMin) return false;
      if (f.chapterMax !== null && n > f.chapterMax) return false;
    }

    if (hasBadgeInclude || hasBadgeExclude) {
      const owned = badgeMap.get(t.id) ?? EMPTY_SET;

      if (hasBadgeInclude) {
        if (f.badgeMatch === 'ALL') {
          // Match ALL: badgeInclude ⊆ owned
          for (const b of f.badgeInclude) if (!owned.has(b)) return false;
        } else {
          // Match ANY: irisan tak kosong
          let hit = false;
          for (const b of f.badgeInclude) {
            if (owned.has(b)) {
              hit = true;
              break;
            }
          }
          if (!hit) return false;
        }
      }

      // Exclude: irisan harus kosong
      if (hasBadgeExclude) {
        for (const b of f.badgeExclude) if (owned.has(b)) return false;
      }
    }

    return matchesSearch(t, needle);
  });

  return sortTitles(result, f.sort);
}

const EMPTY_SET: Set<string> = new Set();

export function sortTitles(titles: Title[], sort: FilterState['sort']): Title[] {
  const out = [...titles];
  switch (sort) {
    case 'title':
      return out.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    case 'tier':
      return out.sort(
        (a, b) =>
          (TIER_RANK.get(a.tier) ?? 99) - (TIER_RANK.get(b.tier) ?? 99) ||
          a.title.localeCompare(b.title, 'id'),
      );
    case 'year':
      // tanpa tahun ditaruh paling akhir
      return out.sort(
        (a, b) =>
          (b.yearOriginal ?? -Infinity) - (a.yearOriginal ?? -Infinity) ||
          a.title.localeCompare(b.title, 'id'),
      );
    case 'chapters':
      // terbanyak dulu; tanpa data chapter ditaruh paling akhir
      return out.sort(
        (a, b) =>
          (chapterCount(b) ?? -Infinity) - (chapterCount(a) ?? -Infinity) ||
          a.title.localeCompare(b.title, 'id'),
      );
    case 'chapters-asc':
      return out.sort(
        (a, b) =>
          (chapterCount(a) ?? Infinity) - (chapterCount(b) ?? Infinity) ||
          a.title.localeCompare(b.title, 'id'),
      );
    case 'recent':
    default:
      return out.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const SORT_LABELS: Record<FilterState['sort'], string> = {
  recent: 'Terbaru ditambah',
  title: 'Judul (A–Z)',
  tier: 'Tier (SS→)',
  year: 'Tahun (terbaru)',
  chapters: 'Chapter (terbanyak)',
  'chapters-asc': 'Chapter (tersedikit)',
};
