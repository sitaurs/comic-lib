import { addBadges, emptyParsed, type ParsedTitle, type ParseResult } from '../types';
import { normalizeWorkStatus } from './status';
import { buildReadLinks } from '../../lib/readLinks';

/**
 * Parser TXT — spec §3.1 (L99–L113).
 * Struktur: header section `=== LIST n — ... ===`, numbering restart per section,
 * tiap entri 2 baris:
 *   <n>. <Title> — Indo <NNN>ch [TAMAT|ONGOING] (raw: <status mentah>
 *      <URL>
 *
 * Catatan penting:
 * - Nested paren pada `(raw: ...)`: JANGAN non-greedy `\)`. Ambil sisa baris
 *   sampai EOL lalu buang `)` penutup terakhir bila ada. Raw kadang terpotong
 *   (`(Complet`, `(C)`) → simpan apa adanya ke statusRaw (spec L108).
 * - Judul memuat Unicode (’ – :) — jangan strip (spec L110).
 * - indoStatus (bracket) & workStatus (dari statusRaw) adalah dua sinyal
 *   independen dan boleh berbeda (spec L111).
 */
const SECTION_RE = /^===\s*LIST\s*(\d+)/i;
const ENTRY_RE =
  /^\s*(\d+)\.\s+(.+?)\s+—\s+Indo\s+(\d+)ch\s+\[(TAMAT|ONGOING)\]\s*\(raw:\s*(.*)$/;
/** Varian toleran: tanpa bagian `(raw: ...)` (NFR-08). */
const ENTRY_RE_NO_RAW = /^\s*(\d+)\.\s+(.+?)\s+—\s+Indo\s+(\d+)ch\s+\[(TAMAT|ONGOING)\]\s*$/;
const URL_RE = /^\s+(https?:\/\/\S+)\s*$/;

export function parseTxt(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const titles: ParsedTitle[] = [];
  const warnings: string[] = [];
  let section = '';
  let detected = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      section = `list${sectionMatch[1]}`;
      continue;
    }

    const m = ENTRY_RE.exec(line) ?? ENTRY_RE_NO_RAW.exec(line);
    if (!m) continue;

    detected++;
    const [, no, rawTitle, chapters, bracket, rawTail] = m;
    const p = emptyParsed(`${section || 'list?'}/${no ?? '?'}`);

    p.title = (rawTitle ?? '').trim();
    if (!p.title) p.issues.push('Judul kosong');

    p.indoChapters = chapters ? Number(chapters) : null;
    p.indoStatus = bracket === 'TAMAT' || bracket === 'ONGOING' ? bracket : null;

    if (rawTail !== undefined) {
      p.statusRaw = stripTrailingParen(rawTail);
      p.workStatus = normalizeWorkStatus(p.statusRaw);
    }

    // baris berikutnya yang ter-indentasi berisi URL → readUrls (spec L109)
    const next = lines[i + 1];
    if (next) {
      const urlMatch = URL_RE.exec(next);
      if (urlMatch?.[1]) {
        p.readUrls = buildReadLinks([urlMatch[1]]);
        i++; // konsumsi baris URL
      }
    }

    // TXT tidak memuat genre/tema — biarkan kosong (badge diisi dari CSV/JSON)
    addBadges(p.badgesByCategory, 'Genre', []);

    titles.push(p);
  }

  if (detected === 0) warnings.push('Tidak ada entri yang cocok dengan format TXT');

  return { format: 'txt', titles, detected, warnings };
}

/**
 * Buang HANYA `)` penutup terakhir bila ada — spec L108.
 * Contoh: "248 Chapters (Complete) + Prologue)" → "248 Chapters (Complete) + Prologue".
 * Raw terpotong seperti "(Complet" dibiarkan apa adanya.
 */
function stripTrailingParen(tail: string): string | null {
  const s = tail.trimEnd();
  if (!s) return null;
  const opens = (s.match(/\(/g) ?? []).length;
  const closes = (s.match(/\)/g) ?? []).length;
  // `(raw:` sendiri sudah dilepas, jadi kurung penutup berlebih = penutup raw
  if (closes > opens && s.endsWith(')')) return s.slice(0, -1).trimEnd() || null;
  return s;
}
