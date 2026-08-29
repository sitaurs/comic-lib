import Dexie, { type Table } from 'dexie';
import type {
  Badge,
  BadgeCategory,
  Collection,
  Cover,
  MetaRow,
  Title,
  TitleBadge,
  TitleCollection,
} from './types';

/**
 * Dexie schema — sumber: spec.md §2, baris L14–L28.
 * `&` = primary key, `*` = multi-entry index.
 */
export class ManhwaLibraryDB extends Dexie {
  titles!: Table<Title, string>;
  badges!: Table<Badge, string>;
  badgeCategories!: Table<BadgeCategory, string>;
  titleBadges!: Table<TitleBadge, [string, string]>;
  collections!: Table<Collection, string>;
  titleCollections!: Table<TitleCollection, [string, string]>;
  covers!: Table<Cover, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'manhwa-library') {
    super(name);
    this.version(1).stores({
      titles:
        '&id, title, readingStatus, tier, favorite, workStatus, yearOriginal, createdAt, updatedAt, *altTitles',
      badges: '&id, name, categoryId, createdAt',
      badgeCategories: '&id, name, order',
      titleBadges: '&[titleId+badgeId], titleId, badgeId',
      collections: '&id, name, createdAt',
      titleCollections: '&[titleId+collectionId], titleId, collectionId',
      covers: '&id', // blob store, tidak perlu index lain
      meta: '&key',
    });
  }
}

export const db = new ManhwaLibraryDB();

export const SCHEMA_VERSION = 1;
