import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { seedDefaultCategories } from '../db/seed';
import { parseCsv } from './parsers/csv';
import { buildPreview } from './dedupe';
import { commitImport } from './commit';
import { applyCoverMatches, collectCandidates, matchCovers } from './coverMatcher';

/**
 * V.4 (todos.md) — cover matcher terhadap `covers/list1..4` (118 file).
 * spec §5 L158–L165: hint `cover_file` lebih dulu, lalu slug, lalu fuzzy.
 */
const root = resolve(__dirname, '../..');
const LISTS = ['list1', 'list2', 'list3', 'list4'];

/** Bangun File dari cover di disk, meniru pilihan folder di browser. */
function coverFiles(): File[] {
  const files: File[] = [];
  for (const list of LISTS) {
    const dir = resolve(root, 'covers', list);
    for (const name of readdirSync(dir)) {
      const buf = readFileSync(resolve(dir, name));
      const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const file = new File([buf], name, { type: mime });
      // browser mengisi webkitRelativePath saat memilih folder
      Object.defineProperty(file, 'webkitRelativePath', { value: `covers/${list}/${name}` });
      files.push(file);
    }
  }
  return files;
}

async function wipe() {
  for (const table of db.tables) await table.clear();
  await seedDefaultCategories();
}

describe('V.4 — cover matcher', () => {
  beforeEach(wipe);

  it('mengumpulkan 118 kandidat dari covers/list1..4', async () => {
    const candidates = await collectCandidates(coverFiles());
    expect(candidates).toHaveLength(118);
    expect(candidates.every((c) => c.path.startsWith('covers/list'))).toBe(true);
    // ekstensi campur .png/.jpg (spec L162)
    const mimes = new Set(candidates.map((c) => c.mime));
    expect(mimes.has('image/png')).toBe(true);
    expect(mimes.has('image/jpeg')).toBe(true);
  });

  it('mencocokkan seluruh 118 cover ke judul library.csv lewat hint cover_file', async () => {
    const parsed = parseCsv(readFileSync(resolve(root, 'data/library.csv'), 'utf8'));
    const commit = await commitImport(await buildPreview(parsed.titles));
    expect(commit.inserted).toBe(118);
    expect(commit.coverHints.size).toBe(118);

    const result = await matchCovers(await collectCandidates(coverFiles()), commit.coverHints);
    expect(result.matched).toHaveLength(118);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched.every((m) => m.viaHint)).toBe(true);
    // satu judul tidak boleh dapat dua cover
    expect(new Set(result.matched.map((m) => m.titleId)).size).toBe(118);

    const applied = await applyCoverMatches(result.matched);
    expect(applied).toBe(118);
    expect(await db.covers.count()).toBe(118);
    const titles = await db.titles.toArray();
    expect(titles.every((t) => t.coverId !== null)).toBe(true);
  });

  it('tanpa hint, slug nama file tetap mencocokkan mayoritas judul', async () => {
    const parsed = parseCsv(readFileSync(resolve(root, 'data/library.csv'), 'utf8'));
    await commitImport(await buildPreview(parsed.titles));

    // tanpa coverHints → jalur slug + fuzzy (prefix `NN-` dibuang, spec L161)
    const result = await matchCovers(await collectCandidates(coverFiles()));
    expect(result.matched.length).toBeGreaterThanOrEqual(110);
    expect(result.matched.every((m) => !m.viaHint)).toBe(true);
    expect(new Set(result.matched.map((m) => m.titleId)).size).toBe(result.matched.length);
  });

  it('import 85 judul lama → 33 cover list4 jadi unmatched (spec L164, bukan bug)', async () => {
    const parsed = parseCsv(readFileSync(resolve(root, 'data/metadata.csv'), 'utf8'));
    const commit = await commitImport(await buildPreview(parsed.titles));
    expect(commit.inserted).toBe(85);

    const result = await matchCovers(await collectCandidates(coverFiles()));
    expect(result.matched.length).toBeLessThanOrEqual(85);
    expect(result.unmatched.length).toBeGreaterThanOrEqual(30);
  });
});
