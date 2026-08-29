import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { seedDefaultCategories } from '../db/seed';
import { parseCsv } from './parsers/csv';
import { parseJson } from './parsers/json';
import { buildPreview, summarize } from './dedupe';
import { commitImport } from './commit';

/**
 * V.3 (todos.md) — dedup + Merge.
 * Merge harus mengisi readUrls & metadata tanpa menimpa tier/favorit/status/badge
 * milik pengguna (spec L155–L157).
 */
const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

async function wipe() {
  // hapus berurutan, bukan Promise.all: fake-indexeddb kadang menjadwalkan
  // transaksi paralel di luar urutan sehingga sisa data bocor ke test berikutnya
  for (const table of db.tables) await table.clear();
  await seedDefaultCategories();
}

describe('import pipeline — commit & dedup', () => {
  beforeEach(wipe);

  it('import library.csv memasukkan 118 judul baru', async () => {
    const parsed = parseCsv(read('data/library.csv'));
    const rows = await buildPreview(parsed.titles);
    const summary = summarize(rows);

    expect(summary.detected).toBe(118);
    expect(summary.valid).toBe(118);
    expect(summary.duplicates).toBe(0);
    expect(summary.needsReview).toBe(0);

    const result = await commitImport(rows);
    expect(result.inserted).toBe(118);
    expect(await db.titles.count()).toBe(118);

    // genre & tema jadi badge berkategori otomatis (req L128)
    const genreCat = await db.badgeCategories.where('name').equals('Genre').first();
    const temaCat = await db.badgeCategories.where('name').equals('Tema').first();
    expect(genreCat).toBeDefined();
    expect(temaCat).toBeDefined();
    const genreBadges = await db.badges.where('categoryId').equals(genreCat!.id).count();
    const temaBadges = await db.badges.where('categoryId').equals(temaCat!.id).count();
    expect(genreBadges).toBeGreaterThan(5);
    expect(temaBadges).toBeGreaterThan(5);
    expect(await db.titleBadges.count()).toBeGreaterThan(118);

    // nilai awal hasil import
    const all = await db.titles.toArray();
    expect(all.every((t) => t.tier === 'Unrated')).toBe(true);
    expect(all.every((t) => t.favorite === false)).toBe(true);
    expect(all.every((t) => t.readingStatus === 'belum_baca')).toBe(true);
    expect(all.every((t) => t.readUrls.length === 3)).toBe(true);
  });

  it('re-import mendeteksi seluruh 118 sebagai duplikat', async () => {
    const parsed = parseCsv(read('data/library.csv'));
    await commitImport(await buildPreview(parsed.titles));

    const rows2 = await buildPreview(parseCsv(read('data/library.csv')).titles);
    const summary = summarize(rows2);
    expect(summary.duplicates).toBe(118);
    expect(summary.valid).toBe(0);

    await commitImport(rows2);
    expect(await db.titles.count()).toBe(118); // tidak ada judul ganda
  });

  it('V.3 — Merge mengisi readUrls tanpa menimpa tier/favorit/status/badge', async () => {
    // 1) import metadata.csv lama (85 judul, tanpa link & tanpa judul Korea)
    const oldCsv = parseCsv(read('data/metadata.csv'));
    await commitImport(await buildPreview(oldCsv.titles));

    const before = await db.titles.toArray();
    expect(before).toHaveLength(85);
    expect(before.every((t) => t.readUrls.length === 0)).toBe(true);

    // 2) pengguna men-set tier/favorit/status + badge manual pada satu judul
    const target = before[0]!;
    await db.titles.update(target.id, {
      tier: 'SS',
      favorite: true,
      readingStatus: 'pernah_baca',
    });
    const manualCat = await db.badgeCategories.where('name').equals('Genre').first();
    await db.badges.add({
      id: 'manual-badge',
      name: 'MC OP',
      categoryId: manualCat!.id,
      createdAt: Date.now(),
    });
    await db.titleBadges.put({ titleId: target.id, badgeId: 'manual-badge' });

    // 3) Merge dari metadata.json (punya source_url)
    const json = parseJson(read('data/metadata.json'));
    const rows = await buildPreview(json.titles);
    expect(rows.filter((r) => r.status === 'duplicate')).toHaveLength(85);
    expect(rows.every((r) => r.action === 'merge')).toBe(true);

    const result = await commitImport(rows);
    expect(result.merged).toBe(85);
    expect(result.inserted).toBe(0);
    expect(await db.titles.count()).toBe(85);

    const after = await db.titles.get(target.id);
    // readUrls terisi dari source_url
    expect(after!.readUrls.length).toBeGreaterThanOrEqual(1);
    // preferensi pengguna dipertahankan
    expect(after!.tier).toBe('SS');
    expect(after!.favorite).toBe(true);
    expect(after!.readingStatus).toBe('pernah_baca');
    // badge manual tidak dilepas
    const links = await db.titleBadges.where('titleId').equals(target.id).toArray();
    expect(links.some((l) => l.badgeId === 'manual-badge')).toBe(true);

    // seluruh judul kini punya link baca
    const all = await db.titles.toArray();
    expect(all.every((t) => t.readUrls.length >= 1)).toBe(true);
  });

  it('Merge menggabungkan readUrls sebagai union (tanpa URL duplikat)', async () => {
    const csv = parseCsv(read('data/library.csv'));
    await commitImport(await buildPreview(csv.titles));

    // library.json memuat 3 link yang sama → union tidak menambah duplikat
    const json = parseJson(read('data/library.json'));
    await commitImport(await buildPreview(json.titles));

    const all = await db.titles.toArray();
    for (const t of all) {
      const urls = t.readUrls.map((l) => l.url.replace(/\/+$/, '').toLowerCase());
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  it('Replace menimpa record lama & mengganti badge', async () => {
    const csv = parseCsv(read('data/library.csv'));
    await commitImport(await buildPreview(csv.titles));

    const target = (await db.titles.toArray())[0]!;
    await db.titles.update(target.id, { tier: 'SS', favorite: true });

    const rows = await buildPreview(parseCsv(read('data/library.csv')).titles);
    const replaced = rows.map((r) => ({ ...r, action: 'replace' as const }));
    const result = await commitImport(replaced);

    expect(result.replaced).toBe(118);
    const after = await db.titles.get(target.id);
    // Replace mengembalikan nilai import (tier kembali Unrated)
    expect(after!.tier).toBe('Unrated');
    expect(after!.favorite).toBe(false);
    // cover existing dipertahankan
    expect(after!.coverId).toBe(target.coverId);
  });

  it('Skip tidak mengubah apa pun', async () => {
    const csv = parseCsv(read('data/library.csv'));
    await commitImport(await buildPreview(csv.titles));

    const rows = (await buildPreview(parseCsv(read('data/library.csv')).titles)).map((r) => ({
      ...r,
      action: 'skip' as const,
    }));
    const result = await commitImport(rows);
    expect(result.skipped).toBe(118);
    expect(result.merged).toBe(0);
    expect(await db.titles.count()).toBe(118);
  });

  it('needs review untuk baris tanpa judul (NFR-08)', async () => {
    const csv = parseCsv('judul,judul_korea,link_baca_1\n,,\nNano Machine,나노머신,\n');
    const rows = await buildPreview(csv.titles);
    const summary = summarize(rows);
    expect(summary.needsReview).toBe(1);
    expect(summary.valid).toBe(1);

    const result = await commitImport(rows);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('dedup mengenali kecocokan lewat alt title & judul Korea', async () => {
    await commitImport(
      await buildPreview(parseCsv('judul,judul_alternatif\nNano Machine,Nano Masin\n').titles),
    );

    // judul beda tapi alt title cocok → duplikat "lemah", default Skip (butuh keputusan)
    const rows = await buildPreview(
      parseCsv('judul,judul_alternatif\nNano Masin,\n').titles,
    );
    expect(rows[0]!.status).toBe('duplicate');
    expect(rows[0]!.matchKind).toBe('weak');
    expect(rows[0]!.action).toBe('skip');

    // judul persis sama → duplikat kuat, default Merge
    const strong = await buildPreview(parseCsv('judul\nNano Machine\n').titles);
    expect(strong[0]!.matchKind).toBe('strong');
    expect(strong[0]!.action).toBe('merge');
  });

  it('judul berbeda yang berbagi alt title tidak tertandai duplikat dalam satu batch', async () => {
    // library.csv memang memuat pasangan seperti ini karena alt title diagregasi
    // dari banyak sumber; kalau alt title dianggap identitas penuh, judul sah hilang.
    const csv = [
      'judul,judul_alternatif',
      'Reincarnated War God,Pungunjeonsin | God of War (codezero)',
      'Record of the War God,Pungunjeonsin | Musinjeongi',
      'Past Life Returner,Reincarnator | Past Life Regressor',
      'Reincarnator,Hwansaengjwa',
      '',
    ].join('\n');

    const rows = await buildPreview(parseCsv(csv).titles);
    expect(rows.every((r) => r.status === 'valid')).toBe(true);

    const result = await commitImport(rows);
    expect(result.inserted).toBe(4);
  });

  it('duplikat di dalam batch yang sama terdeteksi', async () => {
    const rows = await buildPreview(
      parseCsv('judul\nNano Machine\nNano Machine\n').titles,
    );
    expect(rows[0]!.status).toBe('valid');
    expect(rows[1]!.status).toBe('duplicate');
    expect(rows[1]!.batchDuplicateOf).toBe(0);
  });
});
