import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from './parsers/csv';
import { parseJson } from './parsers/json';
import { parseTxt } from './parsers/txt';
import { detectAndParse } from './detect';
import { normalizeWorkStatus } from './parsers/status';
import { splitPipe } from './types';

/**
 * V.1 & V.2 (todos.md) — verifikasi parser terhadap dataset asli.
 * library.csv → 118 judul; metadata.csv/json/txt (format lama) → 85 judul.
 */
const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('V.1 — parser library.csv (format utama, 22 kolom)', () => {
  const result = parseCsv(read('data/library.csv'));

  it('mendeteksi format library-csv dan 118 judul', () => {
    expect(result.format).toBe('library-csv');
    expect(result.detected).toBe(118);
    expect(result.titles).toHaveLength(118);
    expect(result.titles.every((t) => t.title.length > 0)).toBe(true);
  });

  it('judul_korea terisi pada 33 judul (list4)', () => {
    const withKo = result.titles.filter((t) => t.titleKo);
    expect(withKo).toHaveLength(33);
  });

  it('V.9 — link_baca_1/2/3 sudah terisi → 3 readUrls per judul', () => {
    // Scraping selesai 29 Agu 2026: seluruh 118 baris punya 3 link.
    // Importer tetap harus tahan kolom kosong; itu diuji lewat metadata.csv.
    expect(result.titles.every((t) => t.readUrls.length === 3)).toBe(true);
    const sources = new Set(result.titles.flatMap((t) => t.readUrls.map((l) => l.source)));
    expect(sources).toContain('komiku');
    expect(sources).toContain('bacakomik');
    expect(sources).toContain('other'); // komikindo.ch dll
  });

  it('dedup URL identik dalam satu baris', () => {
    for (const t of result.titles) {
      const urls = t.readUrls.map((l) => l.url.replace(/\/+$/, '').toLowerCase());
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  it('alt title dipisah pipe, bukan koma', () => {
    const first = result.titles[0]!;
    expect(first.altTitles).toContain('Pendekar Tak Terkalahkan');
    // nama yang memuat koma tidak boleh terpecah
    expect(result.titles.every((t) => t.altTitles.every((a) => a.length > 0))).toBe(true);
  });

  it('genre & tema jadi badge berkategori', () => {
    const first = result.titles[0]!;
    expect(first.badgesByCategory['Genre']).toContain('Action');
    expect(first.badgesByCategory['Genre']).toContain('Martial Arts');
    expect(first.badgesByCategory['Tema']).toContain('Cultivation');
  });

  it('cover_file terisi untuk seluruh 118 judul', () => {
    expect(result.titles.filter((t) => t.coverFile)).toHaveLength(118);
    expect(result.titles[0]!.coverFile).toBe('list1/01-the-undefeatable-swordsman.png');
  });

  it('yearIndo null (library.csv tidak punya tahun_indo)', () => {
    expect(result.titles.every((t) => t.yearIndo === null)).toBe(true);
  });

  it('skor & tahun ter-coerce ke number', () => {
    const first = result.titles[0]!;
    expect(first.yearOriginal).toBe(2020);
    expect(first.scoreAnilist).toBe(71);
    expect(first.scoreMangaupdates).toBeCloseTo(6.71, 2);
    expect(first.type).toBe('Manhwa');
  });
});

describe('V.2 — parser format lama', () => {
  it('metadata.csv → 85 judul, ada tahun_indo, tanpa judul_korea & link', () => {
    const result = parseCsv(read('data/metadata.csv'));
    expect(result.format).toBe('metadata-csv');
    expect(result.titles).toHaveLength(85);
    expect(result.titles.every((t) => t.titleKo === null)).toBe(true);
    expect(result.titles.every((t) => t.readUrls.length === 0)).toBe(true);
    expect(result.titles.some((t) => t.yearIndo !== null)).toBe(true);
  });

  it('metadata.json → 85 judul dengan readUrls[0] dari source_url', () => {
    const result = parseJson(read('data/metadata.json'));
    expect(result.titles).toHaveLength(85);
    expect(result.titles.every((t) => t.readUrls.length >= 1)).toBe(true);

    const komiku = result.titles.filter((t) => t.readUrls[0]?.source === 'komiku');
    const baca = result.titles.filter((t) => t.readUrls[0]?.source === 'bacakomik');
    expect(komiku).toHaveLength(72);
    expect(baca).toHaveLength(13);
  });

  it('coerce year_original yang berupa string', () => {
    const result = parseJson(read('data/metadata.json'));
    const years = result.titles.map((t) => t.yearOriginal).filter((y) => y !== null);
    expect(years.every((y) => typeof y === 'number' && Number.isFinite(y))).toBe(true);
  });

  it('TXT → 85 entri, 1 URL per entri, judul Unicode utuh', () => {
    const result = parseTxt(read('data/list-manhwa-asli.txt'));
    expect(result.detected).toBe(85);
    expect(result.titles).toHaveLength(85);
    expect(result.titles.every((t) => t.readUrls.length === 1)).toBe(true);

    // en-dash & apostrof typografis tidak di-strip
    expect(result.titles.some((t) => t.title.includes('–'))).toBe(true);
    expect(result.titles.some((t) => t.title.includes('’'))).toBe(true);
  });

  it('TXT menyimpan dua sinyal status independen', () => {
    const result = parseTxt(read('data/list-manhwa-asli.txt'));
    expect(result.titles.every((t) => t.indoStatus !== null)).toBe(true);
    expect(result.titles.every((t) => t.indoChapters !== null)).toBe(true);
    // ada entri yang bracket TAMAT tapi workStatus bukan complete (atau sebaliknya)
    const divergent = result.titles.filter(
      (t) =>
        (t.indoStatus === 'TAMAT' && t.workStatus !== 'complete') ||
        (t.indoStatus === 'ONGOING' && t.workStatus !== 'ongoing'),
    );
    expect(divergent.length).toBeGreaterThan(0);
  });

  it('TXT: nested paren pada (raw: …) tidak terpotong salah', () => {
    const result = parseTxt(read('data/list-manhwa-asli.txt'));
    const nested = result.titles.find((t) => t.statusRaw?.includes('(Complete)'));
    expect(nested).toBeDefined();
    // penutup raw dibuang, kurung dalam tetap utuh
    expect(nested!.statusRaw!.endsWith('))')).toBe(false);
    expect(result.titles.every((t) => !t.statusRaw?.startsWith('raw:'))).toBe(true);
  });
});

describe('library.json (118 judul, sudah punya link_baca_*)', () => {
  const result = parseJson(read('data/library.json'));

  it('118 judul dengan readUrls terisi', () => {
    expect(result.titles).toHaveLength(118);
    expect(result.titles.every((t) => t.readUrls.length >= 1)).toBe(true);
  });

  it('judul Korea dari field `korean`', () => {
    expect(result.titles.filter((t) => t.titleKo)).toHaveLength(33);
  });

  it('dedup URL identik antar kolom', () => {
    for (const t of result.titles) {
      const urls = t.readUrls.map((l) => l.url.replace(/\/+$/, '').toLowerCase());
      expect(new Set(urls).size).toBe(urls.length);
    }
  });
});

describe('deteksi format otomatis', () => {
  it('mengenali csv / json / txt dari isi file', () => {
    expect(detectAndParse(read('data/library.csv'), 'library.csv').format).toBe('library-csv');
    expect(detectAndParse(read('data/metadata.csv'), 'metadata.csv').format).toBe('metadata-csv');
    expect(detectAndParse(read('data/metadata.json'), 'metadata.json').format).toBe(
      'metadata-json',
    );
    expect(detectAndParse(read('data/list-manhwa-asli.txt'), 'list.txt').format).toBe('txt');
  });
});

describe('status normalizer (spec §3.5)', () => {
  it('memetakan ~9 varian ke workStatus', () => {
    expect(normalizeWorkStatus('248 Chapters (Complete)')).toBe('complete');
    expect(normalizeWorkStatus('120 Chapters (Completed)')).toBe('complete');
    expect(normalizeWorkStatus('(Complete / Axed)')).toBe('complete');
    expect(normalizeWorkStatus('(Complete/Axed)')).toBe('complete');
    expect(normalizeWorkStatus('90 Chapters (Ongoing)')).toBe('ongoing');
    expect(normalizeWorkStatus('(Hiatus)')).toBe('hiatus');
    expect(normalizeWorkStatus('(Hiatus?)')).toBe('hiatus');
    expect(normalizeWorkStatus('(Dropped)')).toBe('dropped');
    expect(normalizeWorkStatus('(Cancelled)')).toBe('cancelled');
  });

  it('toleran terhadap raw terpotong & kosong (NFR-08)', () => {
    expect(normalizeWorkStatus('30 Chapters (Complet')).toBe('complete');
    expect(normalizeWorkStatus('(C)')).toBe('unknown');
    expect(normalizeWorkStatus('')).toBe('unknown');
    expect(normalizeWorkStatus(null)).toBe('unknown');
    expect(normalizeWorkStatus('teks tanpa kurung')).toBe('unknown');
  });

  it('prioritas cancel > drop > hiatus > complete > ongoing', () => {
    expect(normalizeWorkStatus('(Ongoing, then Cancelled)')).toBe('cancelled');
    expect(normalizeWorkStatus('(Complete but Dropped)')).toBe('dropped');
  });
});

describe('split alt title', () => {
  it('memakai pipe dan mempertahankan koma di dalam nama', () => {
    expect(splitPipe('A, B | C | D')).toEqual(['A, B', 'C', 'D']);
    expect(splitPipe('')).toEqual([]);
    expect(splitPipe(null)).toEqual([]);
  });
});
