import { create } from 'zustand';
import type { ReadingStatus, Tier, WorkStatus } from '../db/types';

/**
 * filterStore — spec §6 L166–L190.
 * Include/Exclude independen (req FR-09), Match ALL/ANY untuk badge (FR-10).
 */
export type SortKey = 'title' | 'recent' | 'tier' | 'year';
export type BadgeMatch = 'ALL' | 'ANY';

export interface FilterState {
  search: string;
  readingStatus: Set<ReadingStatus>; // include
  tiers: Set<Tier>; // include
  favoriteOnly: boolean;
  workStatus: Set<WorkStatus>;
  badgeInclude: Set<string>; // badge ids
  badgeExclude: Set<string>;
  badgeMatch: BadgeMatch;
  collectionId: string | null;
  sort: SortKey;
}

interface FilterActions {
  setSearch: (v: string) => void;
  toggleReadingStatus: (v: ReadingStatus) => void;
  toggleTier: (v: Tier) => void;
  setFavoriteOnly: (v: boolean) => void;
  toggleWorkStatus: (v: WorkStatus) => void;
  toggleBadgeInclude: (id: string) => void;
  toggleBadgeExclude: (id: string) => void;
  setBadgeMatch: (v: BadgeMatch) => void;
  /** Klik badge di kartu → filter library (FR-11, spec L190). */
  filterByBadge: (id: string) => void;
  setCollection: (id: string | null) => void;
  setSort: (v: SortKey) => void;
  clear: () => void;
  activeCount: () => number;
}

export const initialFilterState: FilterState = {
  search: '',
  readingStatus: new Set(),
  tiers: new Set(),
  favoriteOnly: false,
  workStatus: new Set(),
  badgeInclude: new Set(),
  badgeExclude: new Set(),
  badgeMatch: 'ALL',
  collectionId: null,
  sort: 'recent',
};

function toggleIn<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  ...initialFilterState,

  setSearch: (search) => set({ search }),
  toggleReadingStatus: (v) => set((s) => ({ readingStatus: toggleIn(s.readingStatus, v) })),
  toggleTier: (v) => set((s) => ({ tiers: toggleIn(s.tiers, v) })),
  setFavoriteOnly: (favoriteOnly) => set({ favoriteOnly }),
  toggleWorkStatus: (v) => set((s) => ({ workStatus: toggleIn(s.workStatus, v) })),

  toggleBadgeInclude: (id) =>
    set((s) => {
      const badgeInclude = toggleIn(s.badgeInclude, id);
      // sebuah badge tidak boleh berada di Include & Exclude sekaligus
      const badgeExclude = new Set(s.badgeExclude);
      if (badgeInclude.has(id)) badgeExclude.delete(id);
      return { badgeInclude, badgeExclude };
    }),

  toggleBadgeExclude: (id) =>
    set((s) => {
      const badgeExclude = toggleIn(s.badgeExclude, id);
      const badgeInclude = new Set(s.badgeInclude);
      if (badgeExclude.has(id)) badgeInclude.delete(id);
      return { badgeInclude, badgeExclude };
    }),

  setBadgeMatch: (badgeMatch) => set({ badgeMatch }),

  filterByBadge: (id) =>
    set({ badgeInclude: new Set([id]), badgeExclude: new Set(), badgeMatch: 'ANY' }),

  setCollection: (collectionId) => set({ collectionId }),
  setSort: (sort) => set({ sort }),

  clear: () => set({ ...initialFilterState, sort: get().sort }),

  activeCount: () => {
    const s = get();
    return (
      s.readingStatus.size +
      s.tiers.size +
      s.workStatus.size +
      s.badgeInclude.size +
      s.badgeExclude.size +
      (s.favoriteOnly ? 1 : 0) +
      (s.collectionId ? 1 : 0) +
      (s.search.trim() ? 1 : 0)
    );
  },
}));
