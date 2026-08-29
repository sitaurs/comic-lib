import Papa from 'papaparse';
import { db, SCHEMA_VERSION } from '../db/db';
import type {
  Badge,
  BadgeCategory,
  Collection,
  Cover,
  MetaRow,
  Title,
  TitleBadge,
  TitleCollection,
} from '../db/types';
import { LIBRARY_CSV_HEADER } from '../import/parsers/csv';
import { revokeAllCoverUrls } from './coverCache';

/**
 * Backup / Restore — spec §7 L192–L196, req FR-25 (L100–L101).
 *
 * - Export penuh: ZIP = `library.json` (semua tabel kecuali blob cover)
 *   + `covers/<coverId>.<ext>` + `manifest.json` (schemaVersion, tanggal, count).
 * - Export CSV: 22 kolom `library.csv` (spec §3.2 L114–L125) untuk interop dua arah.
 * - Restore: validasi schemaVersion, tulis ulang semua store dalam SATU transaksi.
 */

export const LIBRARY_JSON_NAME = 'library.json';
export const MANIFEST_NAME = 'manifest.json';
export const COVERS_DIR = 'covers';

/** Tabel yang ikut ke `library.json` — blob cover disimpan sebagai file terpisah. */
export const BACKUP_TABLES = [
  'titles',
  'badges',
  'badgeCategories',
  'collections',
  'titleBadges',
  'titleCollections',
  'meta',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** Isi `library.json` — satu key per tabel (spec L193). */
export interface BackupLibraryJson {
  titles: Title[];
  badges: Badge[];
  badgeCategories: BadgeCategory[];
  collections: Collection[];
  titleBadges: TitleBadge[];
  titleCollections: TitleCollection[];
  meta: MetaRow[];
}

export interface BackupManifest {
  /** Versi skema Dexie saat export — divalidasi ulang saat restore (spec L196). */
  schemaVersion: number;
  /** Tanggal export dalam ISO-8601. */
  exportedAt: string;
  app: string;
  /** Jumlah record per tabel (termasuk `covers`). */
  counts: BackupCounts;
}

export type BackupCounts = Record<BackupTableName | 'covers', number>;

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  mode: RestoreMode;
  schemaVersion: number;
  exportedAt: string | null;
  /** Jumlah record yang benar-benar ditulis per tabel. */
  counts: BackupCounts;
}

/** mime → ekstensi file cover di dalam ZIP (spec L193 `covers/<coverId>.<ext>`). */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/** Kebalikannya, dipakai saat restore karena mime tidak ikut di nama file. */
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

function extFromMime(mime: string): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? 'bin';
}

function mimeFromExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? 'image/jpeg';
}

function emptyCounts(): BackupCounts {
  return {
    titles: 0,
    badges: 0,
    badgeCategories: 0,
    collections: 0,
    titleBadges: 0,
    titleCollections: 0,
    meta: 0,
    covers: 0,
  };
}

/** Baca seluruh tabel non-blob sekali jalan. */
async function readLibrary(): Promise<BackupLibraryJson> {
  const [titles, badges, badgeCategories, collections, titleBadges, titleCollections, meta] =
    await Promise.all([
      db.titles.toArray(),
      db.badges.toArray(),
      db.badgeCategories.toArray(),
      db.collections.toArray(),
      db.titleBadges.toArray(),
      db.titleCollections.toArray(),
      db.meta.toArray(),
    ]);
  return { titles, badges, badgeCategories, collections, titleBadges, titleCollections, meta };
}

/**
 * Export penuh ke ZIP — spec L193. Portable lintas perangkat.
 * `jszip` di-import dinamis supaya tetap jadi chunk terpisah di build (spec §1).
 */
export async function exportBackupZip(): Promise<Blob> {
  const { default: JSZip } = await import('jszip');

  const library = await readLibrary();
  const covers: Cover[] = await db.covers.toArray();

  const zip = new JSZip();
  zip.file(LIBRARY_JSON_NAME, JSON.stringify(library));

  const coverDir = zip.folder(COVERS_DIR);
  for (const cover of covers) {
    const mime = cover.mime || cover.blob.type || 'image/jpeg';
    // ArrayBuffer, bukan Blob: satu-satunya bentuk yang diterima jszip di
    // browser maupun Node (dipakai test).
    const data = await cover.blob.arrayBuffer();
    // Gambar sudah terkompresi — STORE menghindari deflate yang tak berguna.
    coverDir?.file(`${cover.id}.${extFromMime(mime)}`, data, { compression: 'STORE' });
  }

  const counts: BackupCounts = {
    titles: library.titles.length,
    badges: library.badges.length,
    badgeCategories: library.badgeCategories.length,
    collections: library.collections.length,
    titleBadges: library.titleBadges.length,
    titleCollections: library.titleCollections.length,
    meta: library.meta.length,
    covers: covers.length,
  };

  const manifest: BackupManifest = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'manhwa-library',
    counts,
  };
  zip.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2));

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
  });
}

/** Nama file default untuk unduhan (dipakai BackupPanel). */
export function backupFileName(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `manhwa-library-backup-${stamp}.zip`;
}

export function csvFileName(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `manhwa-library-${stamp}.csv`;
}

/**
 * Export CSV — spec L194: 22 kolom mengikuti `library.csv` agar interop dua arah
 * (hasilnya bisa di-import ulang lewat `parseCsv`).
 * Memakai `Papa.unparse` supaya quoting RFC-4180 benar (sinopsis memuat koma/quote).
 */
export async function exportCsv(): Promise<string> {
  const [titles, badges, badgeCategories, titleBadges] = await Promise.all([
    db.titles.orderBy('title').toArray(),
    db.badges.toArray(),
    db.badgeCategories.toArray(),
    db.titleBadges.toArray(),
  ]);

  // Balik pemetaan badge → kolom: kategori "Genre" → genre_terverifikasi,
  // kategori "Tema" → tema (spec L121).
  const categoryNameById = new Map(badgeCategories.map((c) => [c.id, c.name.toLowerCase()] as const));
  const badgeById = new Map(badges.map((b) => [b.id, b] as const));

  const genreByTitle = new Map<string, string[]>();
  const temaByTitle = new Map<string, string[]>();
  for (const link of titleBadges) {
    const badge = badgeById.get(link.badgeId);
    if (!badge) continue;
    const category = categoryNameById.get(badge.categoryId);
    const bucket =
      category === 'genre' ? genreByTitle : category === 'tema' ? temaByTitle : null;
    if (!bucket) continue;
    const list = bucket.get(link.titleId);
    if (list) list.push(badge.name);
    else bucket.set(link.titleId, [badge.name]);
  }

  const rows = titles.map((t, i) => {
    // readUrls[0..2] → link_baca_1/2/3 (spec L123); sisanya tidak punya kolom.
    const link1 = t.readUrls[0]?.url ?? '';
    const link2 = t.readUrls[1]?.url ?? '';
    const link3 = t.readUrls[2]?.url ?? '';

    return {
      list: '',
      no: String(i + 1),
      judul: t.title,
      judul_korea: t.titleKo ?? '',
      // spec L121: alt title dipisah PIPE, bukan koma
      judul_alternatif: t.altTitles.join(' | '),
      genre_terverifikasi: (genreByTitle.get(t.id) ?? []).join(', '),
      // seluruh genre ditulis ke kolom terverifikasi; re-import menggabungkan keduanya
      genre_1sumber: '',
      tema: (temaByTitle.get(t.id) ?? []).join(', '),
      tahun_asli: t.yearOriginal === null ? '' : String(t.yearOriginal),
      tipe: t.type ?? '',
      status: t.statusRaw ?? '',
      author: t.authors.join(', '),
      skor_anilist: t.scoreAnilist === null ? '' : String(t.scoreAnilist),
      skor_mangaupdates: t.scoreMangaupdates === null ? '' : String(t.scoreMangaupdates),
      // skor_mal selalu kosong di dataset (spec L121)
      skor_mal: '',
      // `sumber` & `cover_file` adalah metadata file sumber, bukan field Title —
      // cover ikut di backup ZIP, bukan di CSV.
      sumber: '',
      cover_file: '',
      link_baca_1: link1,
      link_baca_2: link2,
      link_baca_3: link3,
      sinopsis_id: t.synopsisId ?? '',
      sinopsis_en: t.synopsisEn ?? '',
    } satisfies Record<(typeof LIBRARY_CSV_HEADER)[number], string>;
  });

  return Papa.unparse(rows, {
    // urutan kolom wajib sama dengan parser (22 kolom, spec L117)
    columns: [...LIBRARY_CSV_HEADER],
    newline: '\n',
  });
}

interface ParsedZip {
  library: BackupLibraryJson;
  manifest: BackupManifest | null;
  covers: Cover[];
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Restore dari ZIP — spec L196.
 * Validasi `manifest.schemaVersion`, lalu tulis ulang semua store dalam SATU transaksi
 * (mode `replace` menghapus data lama lebih dulu, `merge` hanya bulkPut).
 */
export async function restoreBackupZip(file: File | Blob, mode: RestoreMode): Promise<RestoreResult> {
  const { library, manifest, covers } = await readBackupZip(file);

  const counts = emptyCounts();
  counts.titles = library.titles.length;
  counts.badges = library.badges.length;
  counts.badgeCategories = library.badgeCategories.length;
  counts.collections = library.collections.length;
  counts.titleBadges = library.titleBadges.length;
  counts.titleCollections = library.titleCollections.length;
  counts.meta = library.meta.length;
  counts.covers = covers.length;

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      // destruktif: seluruh data lama dibuang lebih dulu (dikonfirmasi di UI)
      for (const table of db.tables) await table.clear();
    }
    await db.titles.bulkPut(library.titles);
    await db.badgeCategories.bulkPut(library.badgeCategories);
    await db.badges.bulkPut(library.badges);
    await db.collections.bulkPut(library.collections);
    await db.titleBadges.bulkPut(library.titleBadges);
    await db.titleCollections.bulkPut(library.titleCollections);
    await db.meta.bulkPut(library.meta);
    // Cover Blob dimuat kembali dengan id aslinya agar title.coverId tetap valid.
    await db.covers.bulkPut(covers);
  });

  // objectURL lama menunjuk blob yang sudah tak relevan → lepas semuanya.
  revokeAllCoverUrls();

  return {
    mode,
    schemaVersion: manifest?.schemaVersion ?? SCHEMA_VERSION,
    exportedAt: manifest?.exportedAt ?? null,
    counts,
  };
}

/** Baca & validasi isi ZIP tanpa menyentuh database (dipakai restore + test). */
export async function readBackupZip(file: File | Blob): Promise<ParsedZip> {
  const { default: JSZip } = await import('jszip');

  // ArrayBuffer, bukan Blob langsung: jszip tidak bisa membaca Blob di Node.
  const buffer = await file.arrayBuffer();
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('File tidak bisa dibaca sebagai ZIP. Pilih file backup .zip yang valid.');
  }

  const manifestEntry = zip.file(MANIFEST_NAME);
  if (!manifestEntry) {
    throw new Error(`ZIP tidak berisi ${MANIFEST_NAME} — sepertinya bukan backup Manhwa Library.`);
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await manifestEntry.async('string')) as BackupManifest;
  } catch {
    throw new Error(`${MANIFEST_NAME} rusak / bukan JSON yang valid.`);
  }

  const version = Number(manifest.schemaVersion);
  if (!Number.isFinite(version)) {
    throw new Error(`${MANIFEST_NAME} tidak memuat schemaVersion yang valid.`);
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Backup memakai schemaVersion ${version}, lebih baru dari aplikasi ini (${SCHEMA_VERSION}). ` +
        'Perbarui aplikasi lebih dulu sebelum melakukan restore.',
    );
  }

  const libraryEntry = zip.file(LIBRARY_JSON_NAME);
  if (!libraryEntry) {
    throw new Error(`ZIP tidak berisi ${LIBRARY_JSON_NAME} — data judul tidak ditemukan.`);
  }

  let raw: Partial<BackupLibraryJson>;
  try {
    raw = JSON.parse(await libraryEntry.async('string')) as Partial<BackupLibraryJson>;
  } catch {
    throw new Error(`${LIBRARY_JSON_NAME} rusak / bukan JSON yang valid.`);
  }

  const library: BackupLibraryJson = {
    titles: asArray<Title>(raw.titles),
    badges: asArray<Badge>(raw.badges),
    badgeCategories: asArray<BadgeCategory>(raw.badgeCategories),
    collections: asArray<Collection>(raw.collections),
    titleBadges: asArray<TitleBadge>(raw.titleBadges),
    titleCollections: asArray<TitleCollection>(raw.titleCollections),
    meta: asArray<MetaRow>(raw.meta),
  };

  const prefix = `${COVERS_DIR}/`;
  const coverEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.startsWith(prefix),
  );

  const covers: Cover[] = [];
  for (const entry of coverEntries) {
    const fileName = entry.name.slice(prefix.length);
    if (!fileName) continue;
    const dot = fileName.lastIndexOf('.');
    const id = dot > 0 ? fileName.slice(0, dot) : fileName;
    const mime = mimeFromExt(dot > 0 ? fileName.slice(dot + 1) : '');
    const data = await entry.async('arraybuffer');
    // mime di-set ulang: nama file di ZIP tidak menyimpan tipe.
    covers.push({ id, blob: new Blob([data], { type: mime }), mime });
  }

  return { library, manifest, covers };
}
