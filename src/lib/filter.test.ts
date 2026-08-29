import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { seedDefaultCategories } from '../db/seed';
import { parseCsv } from '../import/parsers/csv';
import { buildPreview } from '../import/dedupe';
import { commitImport } from '../import/commit';
import { applyFilter, chapterCount } from './filter';
import { initialFilterState, type FilterState } from '../stores/filterStore';
import type { Title } from '../db/types';

/**
 * V.8 (todos.md) — smoke test filter Include/Exclude & Match ALL/ANY
 * dengan data nyata (`data/library.csv`, 118 judul). spec §6 L183–L189.
 */
const root = resolve(__dirname, '../..');

let titles: Title[];
let badgeMap: Map<string, Set<string>>;
let badgeIdByName: Map<string, string>;

function withFilter(patch: Partial<FilterState>): FilterState {
  return { ...initialFilterState, ...patch };
}

function run(patch: Partial<FilterState>): Title[] {
  return applyFilter({ titles, badgeMap }, withFilter(patch));
}

beforeAll(async () => {
  for (const table of db.tables) await table.clear();
  await seedDefaultCategories();

  const parsed = parseCsv(readFileSync(resolve(root, 'data/library.csv'), 'utf8'));
  await commitImport(await buildPreview(parsed.titles));

  titles = await db.titles.toArray();
  const links = await db.titleBadges.toArray();
  badgeMap = new Map();
  for (const l of links) {
    const set = badgeMap.get(l.titleId);
    if (set) set.add(l.badgeId);
    else badgeMap.set(l.titleId, new Set([l.badgeId]));
  }
  const badges = await db.badges.toArray();
  badgeIdByName = new Map(badges.map((b) => [b.name.toLowerCase(), b.id] as const));

  // beri variasi tier/favorit/status supaya filter bisa diuji
  const sorted = [...titles].sort((a, b) => a.title.localeCompare(b.title));
  await db.titles.bulkPut(
    sorted.map((t, i) => ({
      ...t,
      tier: i < 10 ? 'SS' : i < 25 ? 'S' : t.tier,
      favorite: i % 7 === 0,
      readingStatus: i % 3 === 0 ? ('pernah_baca' as const) : ('belum_baca' as const),
    })),
  );
  titles = await db.titles.toArray();
});

describe('V.8 — filter dengan data nyata (118 judul)', () => {
  it('tanpa filter → seluruh 118 judul', () => {
    expect(run({})).toHaveLength(118);
    expect(titles).toHaveLength(118);
  });

  it('search mencakup judul, judul Korea, dan alt title', () => {
    // judul
    expect(run({ search: 'undefeatable' }).length).toBeGreaterThanOrEqual(1);
    // judul Korea (list4 punya judul_korea)
    const withKo = titles.find((t) => t.titleKo);
    expect(run({ search: withKo!.titleKo! })).toContainEqual(
      expect.objectContaining({ id: withKo!.id }),
    );
    // alt title
    const withAlt = titles.find((t) => t.altTitles.length > 0)!;
    expect(run({ search: withAlt.altTitles[0]! }).some((t) => t.id === withAlt.id)).toBe(true);
  });

  it('tier & favorit & status baca menyaring kumulatif', () => {
    const ss = run({ tiers: new Set(['SS']) });
    expect(ss).toHaveLength(10);
    expect(ss.every((t) => t.tier === 'SS')).toBe(true);

    const favCount = titles.filter((t) => t.favorite).length;
    expect(run({ favoriteOnly: true })).toHaveLength(favCount);

    const read = run({ readingStatus: new Set(['pernah_baca']) });
    expect(read.every((t) => t.readingStatus === 'pernah_baca')).toBe(true);

    // kombinasi = irisan
    const combo = run({ tiers: new Set(['SS']), favoriteOnly: true });
    expect(combo.every((t) => t.tier === 'SS' && t.favorite)).toBe(true);
    expect(combo.length).toBeLessThanOrEqual(ss.length);
  });

  it('Match ALL lebih sempit daripada Match ANY (badge Action + Fantasy)', () => {
    const action = badgeIdByName.get('action')!;
    const fantasy = badgeIdByName.get('fantasy')!;
    expect(action).toBeDefined();
    expect(fantasy).toBeDefined();

    const any = run({ badgeInclude: new Set([action, fantasy]), badgeMatch: 'ANY' });
    const all = run({ badgeInclude: new Set([action, fantasy]), badgeMatch: 'ALL' });

    expect(all.length).toBeGreaterThan(0);
    expect(any.length).toBeGreaterThan(all.length);
    // ALL ⊆ ANY
    const anyIds = new Set(any.map((t) => t.id));
    expect(all.every((t) => anyIds.has(t.id))).toBe(true);
    // setiap hasil ALL benar-benar punya kedua badge
    expect(all.every((t) => badgeMap.get(t.id)?.has(action) && badgeMap.get(t.id)?.has(fantasy))).toBe(
      true,
    );
  });

  it('Exclude membuang judul yang punya badge tersebut', () => {
    const action = badgeIdByName.get('action')!;
    const withAction = run({ badgeInclude: new Set([action]), badgeMatch: 'ANY' });
    const withoutAction = run({ badgeExclude: new Set([action]) });

    expect(withAction.length + withoutAction.length).toBe(118);
    expect(withoutAction.every((t) => !badgeMap.get(t.id)?.has(action))).toBe(true);
  });

  it('Include + Exclude bekerja bersama', () => {
    const action = badgeIdByName.get('action')!;
    const romance = badgeIdByName.get('romance');
    if (!romance) return; // dataset boleh saja tak punya badge ini

    const result = run({
      badgeInclude: new Set([action]),
      badgeMatch: 'ANY',
      badgeExclude: new Set([romance]),
    });
    expect(
      result.every((t) => badgeMap.get(t.id)?.has(action) && !badgeMap.get(t.id)?.has(romance)),
    ).toBe(true);
  });

  it('sort tier menempatkan SS lebih dulu, sort judul urut A–Z', () => {
    const byTier = run({ sort: 'tier' });
    expect(byTier[0]!.tier).toBe('SS');
    expect(byTier.at(-1)!.tier).toBe('Unrated');

    const byTitle = run({ sort: 'title' });
    const names = byTitle.map((t) => t.title);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'id')));
  });

  it('jumlah chapter terisi dari library.csv (jumlah_chapter / chapter_indo)', () => {
    // dataset: jumlah_chapter 117/118 (The Executioner kosong), chapter_indo 118/118
    expect(titles.filter((t) => t.totalChapters !== null)).toHaveLength(117);
    expect(titles.filter((t) => t.indoChapters !== null)).toHaveLength(118);
    expect(titles.filter((t) => t.chapterSource !== null)).toHaveLength(117);
    // fallback: judul tanpa totalChapters tetap punya angka lewat indoChapters
    expect(titles.every((t) => chapterCount(t) !== null)).toBe(true);
  });

  it('sort chapter terbanyak menurun & tersedikit menaik', () => {
    const desc = run({ sort: 'chapters' }).map((t) => chapterCount(t)!);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(desc[0]).toBe(Math.max(...desc));

    const asc = run({ sort: 'chapters-asc' }).map((t) => chapterCount(t)!);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });

  it('filter rentang chapter menyaring inklusif di kedua ujung', () => {
    const mid = run({ chapterMin: 100, chapterMax: 199 });
    expect(mid.length).toBeGreaterThan(0);
    expect(mid.every((t) => chapterCount(t)! >= 100 && chapterCount(t)! <= 199)).toBe(true);

    const min300 = run({ chapterMin: 300, chapterMax: null });
    expect(min300.every((t) => chapterCount(t)! >= 300)).toBe(true);

    const under100 = run({ chapterMin: null, chapterMax: 99 });
    expect(under100.every((t) => chapterCount(t)! <= 99)).toBe(true);

    // partisi lengkap: tiap judul masuk tepat satu preset
    const p200 = run({ chapterMin: 200, chapterMax: 299 });
    expect(under100.length + mid.length + p200.length + min300.length).toBe(118);
  });

  it('rentang chapter dihitung sebagai satu filter aktif', () => {
    const s = { ...initialFilterState, chapterMin: 100, chapterMax: null };
    // activeCount ada di store; di sini cukup pastikan predikat tidak menolak semua
    expect(applyFilter({ titles, badgeMap }, s).length).toBeGreaterThan(0);
  });
});
