import type { ReadLink, Tier, TitleType, WorkStatus } from '../db/types';

/**
 * Bentuk perantara hasil parse — spec §3 L86:
 * pipeline sama untuk semua sumber: parse → normalisasi → dedup → preview → commit.
 */
export interface ParsedTitle {
  title: string;
  titleKo: string | null;
  altTitles: string[];
  readUrls: ReadLink[];
  workStatus: WorkStatus;
  statusRaw: string | null;
  type: TitleType | null;
  yearOriginal: number | null;
  yearIndo: number | null;
  authors: string[];
  scoreAnilist: number | null;
  scoreMangaupdates: number | null;
  indoChapters: number | null;
  indoStatus: 'TAMAT' | 'ONGOING' | null;
  synopsisId: string | null;
  synopsisEn: string | null;
  /** Nama badge per kategori — spec L120/L136 (genre → "Genre", tema → "Tema"). */
  badgesByCategory: Record<string, string[]>;
  /** `cover_file` (`list{N}/{NN-slug}.{ext}`) bila ada — spec L124. */
  coverFile: string | null;
  /** Baris/entri asal untuk penelusuran di preview. */
  sourceRef: string;
  /** Alasan masuk "needs review" (mis. tanpa judul) — spec L154. */
  issues: string[];
}

export type ImportFormat = 'library-csv' | 'metadata-csv' | 'metadata-json' | 'txt';

export interface ParseResult {
  format: ImportFormat;
  titles: ParsedTitle[];
  /** Total entri terdeteksi (termasuk yang cacat) — spec L154 "detected". */
  detected: number;
  warnings: string[];
}

export function emptyParsed(sourceRef: string): ParsedTitle {
  return {
    title: '',
    titleKo: null,
    altTitles: [],
    readUrls: [],
    workStatus: 'unknown',
    statusRaw: null,
    type: null,
    yearOriginal: null,
    yearIndo: null,
    authors: [],
    scoreAnilist: null,
    scoreMangaupdates: null,
    indoChapters: null,
    indoStatus: null,
    synopsisId: null,
    synopsisEn: null,
    badgesByCategory: {},
    coverFile: null,
    sourceRef,
    issues: [],
  };
}

/** Nilai awal judul hasil import — req L128: Unrated / belum_baca / favorite=false. */
export const IMPORT_DEFAULT_TIER: Tier = 'Unrated';

/** Utilitas parsing angka yang toleran (NFR-08). */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  // spec L131: 4 record `year_original` berupa string → Number()
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Split daftar berkoma (`genre_terverifikasi`, `tema`, `author`) — spec L121. */
export function splitComma(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Split alt title dengan PIPE — spec L121.
 * Alt title sendiri boleh mengandung koma, jadi pemisahnya ` | ` bukan `,`.
 */
export function splitPipe(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalisasi tipe karya. */
export function toTitleType(value: string | null | undefined): TitleType | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === 'manhwa') return 'Manhwa';
  if (v === 'manhua') return 'Manhua';
  if (v === 'manga') return 'Manga';
  return null;
}

/** Tambahkan nama badge ke kategori tertentu (dedup, buang kosong). */
export function addBadges(
  target: Record<string, string[]>,
  category: string,
  names: string[],
): void {
  if (names.length === 0) return;
  const existing = target[category] ?? [];
  const seen = new Set(existing.map((n) => n.toLowerCase()));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    existing.push(name);
  }
  target[category] = existing;
}

/** Parse array bergaya Python/JSON dari kolom teks (mis. "['a', 'b']"). */
export function parseListish(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const s = value.trim();
  if (!s || s === '[]' || s === 'None' || s === 'null') return [];
  if (s.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(s.replace(/'/g, '"'));
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // fallback: buang bracket lalu split koma
      return splitComma(s.replace(/^\[|\]$/g, '').replace(/['"]/g, ''));
    }
  }
  return splitComma(s);
}

/** Nilai "kosong" yang muncul di dataset: '', 'None', 'null', 'N/A'. */
export function blankToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === 'None' || s === 'null' || s === 'N/A' || s === '-') return null;
  return s;
}
