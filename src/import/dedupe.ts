import { db } from '../db/db';
import type { Title } from '../db/types';
import { normalizeKey } from '../lib/id';
import { mergeReadLinks } from '../lib/readLinks';
import type { ParsedTitle } from './types';

/**
 * Duplicate Detection — spec §4 (L150–L157).
 * Kunci normalisasi: judul + titleKo (kuat) + altTitles (lemah).
 * Kandidat dicek terhadap library existing DAN terhadap batch itu sendiri (L153).
 *
 * Kenapa alt title dipisah jadi kunci "lemah": pada `library.csv` ada judul yang
 * benar-benar berbeda tapi berbagi alt title hasil agregasi sumber
 * (mis. "Reincarnated War God" ↔ "Record of the War God" berbagi
 * "Pungunjeonsin"/"God of War (codezero)"; "Past Life Returner" ↔ "Reincarnator").
 * Kalau alt title dianggap identitas penuh, 3 judul sah ikut tertandai duplikat.
 * Karena itu:
 *   - kecocokan kunci kuat → duplikat, aksi default **Merge**
 *   - kecocokan hanya lewat alt title → duplikat "lemah", aksi default **Skip**
 *     (perlu keputusan pengguna di Import Preview)
 *   - di dalam satu batch, hanya kunci kuat yang dipakai: satu file sumber sudah
 *     menyatakan baris-barisnya sebagai judul berbeda.
 */
export type DupeAction = 'skip' | 'replace' | 'merge';

export interface PreviewRow {
  parsed: ParsedTitle;
  /** Judul existing yang cocok (bila duplikat). */
  existing: Title | null;
  /** Duplikat di dalam batch yang sama (index baris pertama). */
  batchDuplicateOf: number | null;
  status: 'valid' | 'duplicate' | 'needsReview';
  action: DupeAction;
  /** `strong` = judul/judul Korea sama; `weak` = hanya alt title yang cocok. */
  matchKind: 'strong' | 'weak' | null;
}

export interface PreviewSummary {
  detected: number;
  valid: number;
  duplicates: number;
  needsReview: number;
  /** Bagian dari `duplicates` yang cuma cocok lewat alt title. */
  weakDuplicates: number;
}

interface TitleKeys {
  strong: string[];
  weak: string[];
}

/** Pisahkan kunci identitas kuat (judul + judul Korea) dari kunci lemah (alt title). */
function keysOf(source: {
  title: string;
  titleKo: string | null;
  altTitles: string[];
}): TitleKeys {
  const strong = [...new Set([source.title, source.titleKo ?? ''].map(normalizeKey).filter(Boolean))];
  const strongSet = new Set(strong);
  const weak = [
    ...new Set(source.altTitles.map(normalizeKey).filter((k) => k && !strongSet.has(k))),
  ];
  return { strong, weak };
}

export async function buildPreview(parsedTitles: ParsedTitle[]): Promise<PreviewRow[]> {
  const existingTitles = await db.titles.toArray();

  // dua index terpisah: kunci kuat & kunci lemah → judul existing
  const strongIndex = new Map<string, Title>();
  const weakIndex = new Map<string, Title>();
  for (const t of existingTitles) {
    const keys = keysOf(t);
    for (const key of keys.strong) if (!strongIndex.has(key)) strongIndex.set(key, t);
    for (const key of keys.weak) if (!weakIndex.has(key)) weakIndex.set(key, t);
  }

  const batchStrong = new Map<string, number>();
  const rows: PreviewRow[] = [];

  parsedTitles.forEach((parsed, i) => {
    const keys = keysOf(parsed);

    // needs review: data cacat (mis. tanpa judul) — spec L154
    if (parsed.issues.length > 0 || keys.strong.length === 0) {
      rows.push({
        parsed,
        existing: null,
        batchDuplicateOf: null,
        status: 'needsReview',
        action: 'skip',
        matchKind: null,
      });
      return;
    }

    // kunci kuat kandidat vs kunci kuat existing → duplikat yakin
    const strongHit = keys.strong.map((k) => strongIndex.get(k)).find(Boolean) ?? null;
    // silang kunci kuat↔lemah dan lemah↔lemah → duplikat lemah
    const weakHit =
      strongHit ??
      keys.strong.map((k) => weakIndex.get(k)).find(Boolean) ??
      keys.weak.map((k) => strongIndex.get(k)).find(Boolean) ??
      keys.weak.map((k) => weakIndex.get(k)).find(Boolean) ??
      null;

    const batchHit = keys.strong.map((k) => batchStrong.get(k)).find((v) => v !== undefined) ?? null;

    for (const k of keys.strong) if (!batchStrong.has(k)) batchStrong.set(k, i);

    if (strongHit) {
      // Default Merge: aman untuk kasus melengkapi readUrls (spec L156)
      rows.push({
        parsed,
        existing: strongHit,
        batchDuplicateOf: null,
        status: 'duplicate',
        action: 'merge',
        matchKind: 'strong',
      });
    } else if (weakHit) {
      // hanya alt title yang cocok → jangan gabung otomatis
      rows.push({
        parsed,
        existing: weakHit,
        batchDuplicateOf: null,
        status: 'duplicate',
        action: 'skip',
        matchKind: 'weak',
      });
    } else if (batchHit !== null) {
      rows.push({
        parsed,
        existing: null,
        batchDuplicateOf: batchHit,
        status: 'duplicate',
        action: 'skip',
        matchKind: 'strong',
      });
    } else {
      rows.push({
        parsed,
        existing: null,
        batchDuplicateOf: null,
        status: 'valid',
        action: 'merge',
        matchKind: null,
      });
    }
  });

  return rows;
}

export function summarize(rows: PreviewRow[]): PreviewSummary {
  return {
    detected: rows.length,
    valid: rows.filter((r) => r.status === 'valid').length,
    duplicates: rows.filter((r) => r.status === 'duplicate').length,
    needsReview: rows.filter((r) => r.status === 'needsReview').length,
    weakDuplicates: rows.filter((r) => r.status === 'duplicate' && r.matchKind === 'weak').length,
  };
}

/**
 * Gabungkan kandidat import ke judul existing — spec L155–L157.
 * Union altTitles & readUrls; isi field kosong; PERTAHANKAN tier/favorit/status
 * milik pengguna (dan badge existing tidak pernah dilepas).
 */
export function mergeIntoExisting(existing: Title, parsed: ParsedTitle): Partial<Title> {
  const patch: Partial<Title> = {
    altTitles: unionStrings(existing.altTitles, parsed.altTitles),
    readUrls: mergeReadLinks(existing.readUrls, parsed.readUrls),
    updatedAt: Date.now(),
  };

  // isi hanya field yang masih kosong — jangan timpa data pengguna
  if (!existing.titleKo && parsed.titleKo) patch.titleKo = parsed.titleKo;
  if (!existing.type && parsed.type) patch.type = parsed.type;
  if (existing.yearOriginal === null && parsed.yearOriginal !== null)
    patch.yearOriginal = parsed.yearOriginal;
  if (existing.yearIndo === null && parsed.yearIndo !== null) patch.yearIndo = parsed.yearIndo;
  if (existing.authors.length === 0 && parsed.authors.length > 0) patch.authors = parsed.authors;
  if (existing.scoreAnilist === null && parsed.scoreAnilist !== null)
    patch.scoreAnilist = parsed.scoreAnilist;
  if (existing.scoreMangaupdates === null && parsed.scoreMangaupdates !== null)
    patch.scoreMangaupdates = parsed.scoreMangaupdates;
  if (!existing.statusRaw && parsed.statusRaw) patch.statusRaw = parsed.statusRaw;
  if (existing.workStatus === 'unknown' && parsed.workStatus !== 'unknown')
    patch.workStatus = parsed.workStatus;
  if (existing.indoChapters === null && parsed.indoChapters !== null)
    patch.indoChapters = parsed.indoChapters;
  if (!existing.indoStatus && parsed.indoStatus) patch.indoStatus = parsed.indoStatus;
  if (!existing.synopsisId && parsed.synopsisId) patch.synopsisId = parsed.synopsisId;
  if (!existing.synopsisEn && parsed.synopsisEn) patch.synopsisEn = parsed.synopsisEn;

  // tier / favorite / readingStatus TIDAK disentuh (spec L155)
  return patch;
}

function unionStrings(a: string[], b: string[]): string[] {
  const seen = new Set(a.map((s) => normalizeKey(s)));
  const out = [...a];
  for (const item of b) {
    const key = normalizeKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
