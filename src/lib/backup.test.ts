import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { seedDefaultCategories } from '../db/seed';
import { parseCsv, LIBRARY_CSV_HEADER } from '../import/parsers/csv';
import { buildPreview } from '../import/dedupe';
import { commitImport } from '../import/commit';
import { putCover } from './coverCache';
import { exportBackupZip, exportCsv, restoreBackupZip } from './backup';
import type { Title } from '../db/types';

/**
 * V.5 (todos.md) — backup → wipe → restore identik (spec L218), termasuk
 * `readUrls` & `titleKo`. Plus export CSV 25 kolom yang bisa di-import ulang
 * (spec L194, req FR-25).
 */
const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

async function wipe() {
  // berurutan, bukan Promise.all: fake-indexeddb membocorkan data
  // kalau transaksi clear dijalankan paralel
  for (const table of db.tables) await table.clear();
}

/** Import 118 judul library.csv sebagai kondisi awal. */
async function importLibrary(): Promise<void> {
  await seedDefaultCategories();
  const parsed = parseCsv(read('data/library.csv'));
  await commitImport(await buildPreview(parsed.titles));
}

/** Pasang beberapa cover blob dummy agar jalur `covers/<id>.<ext>` teruji. */
async function attachDummyCovers(count: number): Promise<Map<string, number[]>> {
  const titles = await db.titles.orderBy('title').limit(count).toArray();
  const bytesByCoverId = new Map<string, number[]>();
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]!;
    const bytes = [i, i + 1, i + 2, 255];
    const mime = i % 2 === 0 ? 'image/png' : 'image/jpeg';
    const coverId = await putCover(new Blob([new Uint8Array(bytes)], { type: mime }), mime);
    await db.titles.update(title.id, { coverId });
    bytesByCoverId.set(coverId, bytes);
  }
  return bytesByCoverId;
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())];
}

/** Bandingkan record judul tanpa bergantung urutan tabel. */
function byId(titles: Title[]): Map<string, Title> {
  return new Map(titles.map((t) => [t.id, t] as const));
}

describe('V.5 — backup → wipe → restore', () => {
  beforeEach(wipe);

  it('restore memulihkan seluruh state identik (readUrls & titleKo utuh)', async () => {
    await importLibrary();
    const coverBytes = await attachDummyCovers(5);

    const before = {
      titles: await db.titles.toArray(),
      badges: await db.badges.toArray(),
      badgeCategories: await db.badgeCategories.toArray(),
      titleBadges: await db.titleBadges.toArray(),
      covers: await db.covers.count(),
    };
    expect(before.titles).toHaveLength(118);
    expect(before.covers).toBe(5);
    expect(before.titles.every((t) => t.readUrls.length === 3)).toBe(true);
    expect(before.titles.filter((t) => t.titleKo)).toHaveLength(33);

    // collection + join row supaya seluruh tabel ikut terverifikasi
    await db.collections.add({ id: 'coll-1', name: 'Favorit Mutlak', createdAt: Date.now() });
    await db.titleCollections.put({ titleId: before.titles[0]!.id, collectionId: 'coll-1' });
    await db.meta.put({ key: 'lastBackupTest', value: 42 });

    const zip = await exportBackupZip();
    expect(zip.size).toBeGreaterThan(0);

    await wipe();
    expect(await db.titles.count()).toBe(0);
    expect(await db.covers.count()).toBe(0);
    expect(await db.titleBadges.count()).toBe(0);

    const result = await restoreBackupZip(zip, 'replace');
    expect(result.mode).toBe('replace');
    expect(result.schemaVersion).toBe(1);
    expect(result.exportedAt).toBeTruthy();
    expect(result.counts.titles).toBe(118);
    expect(result.counts.covers).toBe(5);
    expect(result.counts.titleBadges).toBe(before.titleBadges.length);

    // jumlah per tabel kembali
    expect(await db.titles.count()).toBe(118);
    expect(await db.badges.count()).toBe(before.badges.length);
    expect(await db.badgeCategories.count()).toBe(before.badgeCategories.length);
    expect(await db.titleBadges.count()).toBe(before.titleBadges.length);
    expect(await db.collections.count()).toBe(1);
    expect(await db.titleCollections.count()).toBe(1);
    expect(await db.meta.get('lastBackupTest')).toEqual({ key: 'lastBackupTest', value: 42 });

    // record judul identik field-per-field
    const after = byId(await db.titles.toArray());
    for (const original of before.titles) {
      const restored = after.get(original.id);
      expect(restored).toBeDefined();
      expect(restored).toEqual(original);
    }

    // fokus V.5: readUrls & titleKo utuh
    const restoredTitles = [...after.values()];
    expect(restoredTitles.every((t) => t.readUrls.length === 3)).toBe(true);
    expect(restoredTitles.filter((t) => t.titleKo)).toHaveLength(33);
    const sample = after.get(before.titles[0]!.id)!;
    expect(sample.readUrls).toEqual(before.titles[0]!.readUrls);
    expect(sample.readUrls.every((l) => l.url.startsWith('http'))).toBe(true);

    // join row badge kembali persis
    const restoredLinks = new Set(
      (await db.titleBadges.toArray()).map((l) => `${l.titleId}::${l.badgeId}`),
    );
    for (const link of before.titleBadges) {
      expect(restoredLinks.has(`${link.titleId}::${link.badgeId}`)).toBe(true);
    }

    // cover blob kembali dengan id & byte aslinya
    expect(await db.covers.count()).toBe(5);
    for (const [coverId, bytes] of coverBytes) {
      const cover = await db.covers.get(coverId);
      expect(cover).toBeDefined();
      expect(await bytesOf(cover!.blob)).toEqual(bytes);
      expect(cover!.mime).toMatch(/^image\//);
    }
    // title.coverId tetap menunjuk cover yang ada
    const withCover = restoredTitles.filter((t) => t.coverId);
    expect(withCover).toHaveLength(5);
    for (const t of withCover) expect(coverBytes.has(t.coverId!)).toBe(true);
  });

  it('mode merge menambah ke data existing tanpa menghapus', async () => {
    await importLibrary();
    const zip = await exportBackupZip();

    // judul manual yang tidak ada di backup harus bertahan setelah merge
    await db.titles.add({
      ...(await db.titles.orderBy('title').first())!,
      id: 'manual-1',
      title: 'Judul Manual',
      titleKo: null,
    });
    expect(await db.titles.count()).toBe(119);

    const result = await restoreBackupZip(zip, 'merge');
    expect(result.mode).toBe('merge');
    expect(result.counts.titles).toBe(118);
    // 118 dari backup di-bulkPut ke atas record yang sama + 1 judul manual
    expect(await db.titles.count()).toBe(119);
    expect(await db.titles.get('manual-1')).toBeDefined();
  });

  it('replace menghapus judul yang tidak ada di backup', async () => {
    await importLibrary();
    const zip = await exportBackupZip();

    await db.titles.add({
      ...(await db.titles.orderBy('title').first())!,
      id: 'manual-2',
      title: 'Judul Manual 2',
    });

    await restoreBackupZip(zip, 'replace');
    expect(await db.titles.count()).toBe(118);
    expect(await db.titles.get('manual-2')).toBeUndefined();
  });

  it('menolak backup dengan schemaVersion lebih baru (pesan Indonesia)', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('library.json', JSON.stringify({ titles: [] }));
    zip.file('manifest.json', JSON.stringify({ schemaVersion: 99, exportedAt: 'x', counts: {} }));
    const blob = await zip.generateAsync({ type: 'blob' });

    await expect(restoreBackupZip(blob, 'replace')).rejects.toThrow(/schemaVersion 99/);
    await expect(restoreBackupZip(blob, 'replace')).rejects.toThrow(/lebih baru/);
  });

  it('menolak ZIP tanpa manifest.json', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('library.json', JSON.stringify({ titles: [] }));
    const blob = await zip.generateAsync({ type: 'blob' });

    await expect(restoreBackupZip(blob, 'replace')).rejects.toThrow(/manifest\.json/);
  });
});

describe('export CSV (spec §3.2, 25 kolom library.csv)', () => {
  beforeEach(wipe);

  it('25 kolom & 118 baris, alt title memakai pipe', async () => {
    await importLibrary();
    const csv = await exportCsv();

    const lines = csv.split('\n');
    expect(lines[0]).toBe(LIBRARY_CSV_HEADER.join(','));
    expect(LIBRARY_CSV_HEADER).toHaveLength(25);

    // baris data dihitung lewat parser (sinopsis memuat newline di dalam quote)
    const reparsed = parseCsv(csv);
    expect(reparsed.detected).toBe(118);
    expect(reparsed.titles).toHaveLength(118);

    // alt title dipisah ` | `, bukan koma
    const withAlt = reparsed.titles.filter((t) => t.altTitles.length > 1);
    expect(withAlt.length).toBeGreaterThan(0);
    expect(csv).toContain(' | ');
  });

  it('round-trip: hasil export bisa di-import ulang tanpa kehilangan data', async () => {
    await importLibrary();
    const original = await db.titles.orderBy('title').toArray();
    const csv = await exportCsv();

    const reparsed = parseCsv(csv);
    expect(reparsed.format).toBe('library-csv');
    expect(reparsed.titles).toHaveLength(118);

    const parsedByTitle = new Map(reparsed.titles.map((t) => [t.title, t] as const));
    for (const t of original) {
      const p = parsedByTitle.get(t.title);
      expect(p).toBeDefined();
      expect(p!.titleKo).toBe(t.titleKo);
      expect(p!.altTitles).toEqual(t.altTitles);
      expect(p!.authors).toEqual(t.authors);
      expect(p!.yearOriginal).toBe(t.yearOriginal);
      expect(p!.type).toBe(t.type);
      expect(p!.statusRaw).toBe(t.statusRaw);
      // 3 kolom hitungan chapter ikut round-trip (spec §3.2)
      expect(p!.totalChapters).toBe(t.totalChapters);
      expect(p!.indoChapters).toBe(t.indoChapters);
      expect(p!.chapterSource).toBe(t.chapterSource);
      expect(p!.synopsisId).toBe(t.synopsisId);
      expect(p!.synopsisEn).toBe(t.synopsisEn);
      // readUrls[0..2] → link_baca_1/2/3
      expect(p!.readUrls.map((l) => l.url)).toEqual(t.readUrls.slice(0, 3).map((l) => l.url));
    }

    // genre & tema kembali sebagai badge berkategori
    const first = parsedByTitle.get(original[0]!.title)!;
    expect((first.badgesByCategory['Genre'] ?? []).length).toBeGreaterThan(0);
    expect((first.badgesByCategory['Tema'] ?? []).length).toBeGreaterThan(0);

    // import ulang ke DB bersih → 118 judul lagi
    await wipe();
    await seedDefaultCategories();
    const commit = await commitImport(await buildPreview(reparsed.titles));
    expect(commit.inserted).toBe(118);
    expect(await db.titles.count()).toBe(118);
  });
});
