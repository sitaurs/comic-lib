import {
  addBadges,
  blankToNull,
  emptyParsed,
  parseListish,
  toNumber,
  toTitleType,
  type ParsedTitle,
  type ParseResult,
} from '../types';
import { normalizeWorkStatus } from './status';
import { buildReadLinks } from '../../lib/readLinks';

/**
 * Parser JSON — spec §3.4 (L129–L136).
 * Dataset: array objek 28-key (`metadata.json`, 85 judul) atau 32-key
 * (`library.json`, 118 judul dengan `link_baca_*` + `korean` + `cover_file`).
 * Kedua bentuk dikonsumsi lewat jalur yang sama; field yang tidak ada → null.
 */
type JsonRow = Record<string, unknown>;

export function parseJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return {
      format: 'metadata-json',
      titles: [],
      detected: 0,
      warnings: [`JSON tidak valid: ${(err as Error).message}`],
    };
  }

  const rows: JsonRow[] = Array.isArray(data)
    ? (data as JsonRow[])
    : Array.isArray((data as JsonRow)?.titles)
      ? ((data as JsonRow).titles as JsonRow[])
      : [];

  if (rows.length === 0) {
    return {
      format: 'metadata-json',
      titles: [],
      detected: 0,
      warnings: ['JSON tidak memuat array judul'],
    };
  }

  const titles = rows.map(rowToParsed);
  return { format: 'metadata-json', titles, detected: rows.length, warnings: [] };
}

function rowToParsed(row: JsonRow, index: number): ParsedTitle {
  const ref =
    [row['list'], row['no']].filter(Boolean).join('/') || `entri ${index + 1}`;
  const p = emptyParsed(ref);

  p.title = String(row['title'] ?? '').trim();
  if (!p.title) p.issues.push('Judul kosong');

  // library.json memakai `korean`; metadata.json lama tidak punya judul Korea
  p.titleKo = blankToNull(row['korean']);
  p.altTitles = parseListish(row['alt_titles']);
  p.authors = parseListish(row['authors']);

  const statusRaw = blankToNull(row['status_raw']);
  p.statusRaw = statusRaw;
  p.workStatus = normalizeWorkStatus(statusRaw);

  p.type = toTitleType(blankToNull(row['type']));
  // spec L131: 4 record year_original berupa string → Number()
  p.yearOriginal = toNumber(blankToNull(row['year_original']));
  p.yearIndo = toNumber(blankToNull(row['year_indo']));

  p.scoreAnilist = toNumber(blankToNull(row['score_anilist']));
  p.scoreMangaupdates = toNumber(blankToNull(row['score_mangaupdates']));
  // score_mal selalu null di dataset (spec L132)

  p.synopsisId = blankToNull(row['synopsis_id']);
  p.synopsisEn = blankToNull(row['synopsis_en']) ?? blankToNull(row['synopsis_en_alt']);

  // genres_consensus + genres_single_source → "Genre"; themes → "Tema" (spec L135)
  addBadges(p.badgesByCategory, 'Genre', [
    ...parseListish(row['genres_consensus']),
    ...parseListish(row['genres_single_source']),
  ]);
  addBadges(p.badgesByCategory, 'Tema', parseListish(row['themes']));

  // spec L134: cover path tidak ada di metadata.json; library.json punya cover_file
  p.coverFile = blankToNull(row['cover_file']);

  // spec L133: source_url → readUrls[0]; library.json juga punya link_baca_1/2/3
  p.readUrls = buildReadLinks([
    blankToNull(row['source_url']),
    blankToNull(row['link_baca_1']),
    blankToNull(row['link_baca_2']),
    blankToNull(row['link_baca_3']),
  ]);

  return p;
}
