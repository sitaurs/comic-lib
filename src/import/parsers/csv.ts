import Papa from 'papaparse';
import {
  addBadges,
  blankToNull,
  emptyParsed,
  splitComma,
  splitPipe,
  toNumber,
  toTitleType,
  type ParsedTitle,
  type ParseResult,
} from '../types';
import { normalizeWorkStatus } from './status';
import { buildReadLinks } from '../../lib/readLinks';

/**
 * Parser CSV — spec §3.2 (`library.csv`, 22 kolom, format utama) &
 * §3.3 (`metadata.csv`, 19 kolom, format lama).
 *
 * Deteksi format otomatis dari header: ada `judul_korea`/`link_baca_1` → library.csv,
 * ada `tahun_indo` → metadata.csv lama.
 * Memakai papaparse (RFC-4180 sungguhan) karena sinopsis memuat koma/quote/markdown (spec L120).
 */
export const LIBRARY_CSV_HEADER = [
  'list',
  'no',
  'judul',
  'judul_korea',
  'judul_alternatif',
  'genre_terverifikasi',
  'genre_1sumber',
  'tema',
  'tahun_asli',
  'tipe',
  'status',
  // 3 kolom hitungan chapter (spec §3.2) — disisipkan setelah `status`
  'jumlah_chapter',
  'chapter_indo',
  'chapter_sumber',
  'author',
  'skor_anilist',
  'skor_mangaupdates',
  'skor_mal',
  'sumber',
  'cover_file',
  'link_baca_1',
  'link_baca_2',
  'link_baca_3',
  'sinopsis_id',
  'sinopsis_en',
] as const;

type Row = Record<string, string | undefined>;

export function parseCsv(text: string): ParseResult {
  const parsed = Papa.parse<Row>(text, {
    header: true,
    // `true`, bukan `'greedy'`: baris yang semua kolomnya kosong harus tetap muncul
    // supaya bisa diklasifikasikan sebagai *needs review* (NFR-08), bukan dibuang diam-diam.
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const warnings = parsed.errors
    .slice(0, 10)
    .map((e) => `Baris ${e.row ?? '?'}: ${e.message}`);

  const fields = parsed.meta.fields ?? [];
  const isLibrary = fields.includes('judul_korea') || fields.includes('link_baca_1');
  const format = isLibrary ? 'library-csv' : 'metadata-csv';

  const rows = parsed.data.filter((r) => r && Object.keys(r).length > 0);
  const titles = rows.map((row, i) => rowToParsed(row, i, isLibrary));

  return { format, titles, detected: rows.length, warnings };
}

function rowToParsed(row: Row, index: number, isLibrary: boolean): ParsedTitle {
  const listRef = [row['list'], row['no']].filter(Boolean).join('/') || `baris ${index + 2}`;
  const p = emptyParsed(listRef);

  p.title = (row['judul'] ?? '').trim();
  if (!p.title) p.issues.push('Judul kosong');

  // library.csv punya judul_korea; metadata.csv lama tidak (spec L127)
  p.titleKo = isLibrary ? blankToNull(row['judul_korea']) : null;

  // spec L121: alt title dipisah PIPE (alt title sendiri boleh mengandung koma)
  p.altTitles = splitPipe(row['judul_alternatif']);

  const statusRaw = blankToNull(row['status']);
  p.statusRaw = statusRaw;
  p.workStatus = normalizeWorkStatus(statusRaw);

  p.type = toTitleType(row['tipe']);
  p.yearOriginal = toNumber(blankToNull(row['tahun_asli']));
  // library.csv TIDAK punya tahun_indo → null (spec L122)
  p.yearIndo = isLibrary ? null : toNumber(blankToNull(row['tahun_indo']));

  // Hitungan chapter — hanya ada di library.csv (25 kolom); metadata.csv lama
  // tidak punya ketiganya. Ini metadata katalog (total chapter tersedia),
  // BUKAN progress baca — status baca tetap biner (design §4).
  if (isLibrary) {
    p.totalChapters = toNumber(blankToNull(row['jumlah_chapter']));
    p.indoChapters = toNumber(blankToNull(row['chapter_indo']));
    p.chapterSource = blankToNull(row['chapter_sumber']);
  }

  p.authors = splitComma(row['author']);
  p.scoreAnilist = toNumber(blankToNull(row['skor_anilist']));
  p.scoreMangaupdates = toNumber(blankToNull(row['skor_mangaupdates']));
  // skor_mal selalu kosong di dataset (spec L121) → tidak dipetakan

  p.synopsisId = blankToNull(row['sinopsis_id']);
  p.synopsisEn = blankToNull(row['sinopsis_en']);

  // genre_terverifikasi + genre_1sumber → badge "Genre"; tema → badge "Tema" (spec L121)
  addBadges(p.badgesByCategory, 'Genre', [
    ...splitComma(row['genre_terverifikasi']),
    ...splitComma(row['genre_1sumber']),
  ]);
  addBadges(p.badgesByCategory, 'Tema', splitComma(row['tema']));

  p.coverFile = blankToNull(row['cover_file']);

  // link_baca_1/2/3 → readUrls[]; kolom kosong → [] tanpa error (spec L123)
  p.readUrls = isLibrary
    ? buildReadLinks([row['link_baca_1'], row['link_baca_2'], row['link_baca_3']])
    : [];

  return p;
}
