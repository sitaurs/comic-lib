/**
 * Tipe entity — sumber: spec.md §2 (Data Model), baris L30–L83.
 * Status baca biner (req FR-02), tier subjektif (FR-03), link baca jamak (FR-22).
 */

export type ReadingStatus = 'pernah_baca' | 'belum_baca';
export type Tier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'Unrated';
export type WorkStatus =
  | 'ongoing'
  | 'complete'
  | 'hiatus'
  | 'dropped'
  | 'cancelled'
  | 'unknown';
export type TitleType = 'Manhwa' | 'Manhua' | 'Manga';
export type ReadSource = 'komiku' | 'bacakomik' | 'other';

/** spec L60–L67 — satu judul bisa punya beberapa sumber baca. */
export interface ReadLink {
  url: string;
  source: ReadSource; // diturunkan dari host
  label?: string; // opsional, mis. "Mirror"
}

export interface Title {
  id: string;
  title: string;
  titleKo: string | null; // judul Korea (kolom judul_korea)
  altTitles: string[];
  coverId: string | null; // FK -> covers.id
  readUrls: ReadLink[]; // 0..n link baca (link_baca_1/2/3)
  readingStatus: ReadingStatus;
  tier: Tier;
  favorite: boolean;
  workStatus: WorkStatus;
  description: string | null;
  // metadata opsional (dari import)
  type: TitleType | null;
  yearOriginal: number | null;
  yearIndo: number | null; // hanya di metadata.csv lama; null dari library.csv
  authors: string[];
  scoreAnilist: number | null; // 0..100
  scoreMangaupdates: number | null; // 0..10
  statusRaw: string | null; // teks mentah sumber
  indoChapters: number | null; // hitungan chapter Indo (TXT)
  indoStatus: 'TAMAT' | 'ONGOING' | null; // bracket TXT (sinyal terpisah)
  synopsisId: string | null;
  synopsisEn: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Badge {
  id: string;
  name: string;
  categoryId: string;
  color?: string;
  createdAt: number;
}

export interface BadgeCategory {
  id: string;
  name: string;
  order: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverTitleId?: string;
  createdAt: number;
}

export interface Cover {
  id: string;
  blob: Blob;
  mime: string;
  width?: number;
  height?: number;
}

// join tables — spec L80: judul TIDAK menyimpan array badge/collection
export interface TitleBadge {
  titleId: string;
  badgeId: string;
}

export interface TitleCollection {
  titleId: string;
  collectionId: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Nilai default judul baru — req L128 (seed): Unrated / false / belum_baca. */
export function emptyTitle(id: string, now = Date.now()): Title {
  return {
    id,
    title: '',
    titleKo: null,
    altTitles: [],
    coverId: null,
    readUrls: [],
    readingStatus: 'belum_baca',
    tier: 'Unrated',
    favorite: false,
    workStatus: 'unknown',
    description: null,
    type: null,
    yearOriginal: null,
    yearIndo: null,
    authors: [],
    scoreAnilist: null,
    scoreMangaupdates: null,
    statusRaw: null,
    indoChapters: null,
    indoStatus: null,
    synopsisId: null,
    synopsisEn: null,
    createdAt: now,
    updatedAt: now,
  };
}
