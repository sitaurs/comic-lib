import { parseCsv } from './parsers/csv';
import { parseJson } from './parsers/json';
import { parseTxt } from './parsers/txt';
import type { ParseResult } from './types';

/**
 * Deteksi format & jalankan parser yang sesuai — spec §3 (pipeline tunggal).
 * Deteksi berbasis isi (bukan hanya ekstensi) agar file bernama bebas tetap jalan.
 */
export function detectAndParse(text: string, fileName = ''): ParseResult {
  const head = text.slice(0, 4096).trimStart();
  const lower = fileName.toLowerCase();

  if (head.startsWith('[') || head.startsWith('{') || lower.endsWith('.json')) {
    return parseJson(text);
  }

  // TXT punya header section `=== LIST n` atau pola entri "N. Judul — Indo NNNch"
  if (/^===\s*LIST\s*\d/im.test(head) || /^\s*\d+\.\s+.+—\s+Indo\s+\d+ch/m.test(head)) {
    return parseTxt(text);
  }

  if (/(^|,)judul(,|$)/im.test(head.split(/\r?\n/)[0] ?? '') || lower.endsWith('.csv')) {
    return parseCsv(text);
  }

  // fallback: coba CSV, kalau tidak menghasilkan judul coba TXT
  const csv = parseCsv(text);
  if (csv.titles.some((t) => t.title)) return csv;
  return parseTxt(text);
}

export { parseCsv, parseJson, parseTxt };
