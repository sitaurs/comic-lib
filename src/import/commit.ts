import { db } from '../db/db';
import { emptyTitle, type Badge, type BadgeCategory, type Title } from '../db/types';
import { newId } from '../lib/id';
import { mergeIntoExisting, type PreviewRow } from './dedupe';
import { IMPORT_DEFAULT_TIER, type ParsedTitle } from './types';

/**
 * Commit import — spec §3 (parse → normalisasi → dedup → preview → commit).
 * Genre & tema jadi badge berkategori otomatis (req L128, spec L120/L136).
 * Judul baru: tier Unrated, favorite false, status belum_baca.
 */
export interface CommitResult {
  inserted: number;
  merged: number;
  replaced: number;
  skipped: number;
  badgesCreated: number;
  /** titleId → cover_file relatif (dipakai cover matcher setelah commit). */
  coverHints: Map<string, string>;
}

export async function commitImport(rows: PreviewRow[]): Promise<CommitResult> {
  const result: CommitResult = {
    inserted: 0,
    merged: 0,
    replaced: 0,
    skipped: 0,
    badgesCreated: 0,
    coverHints: new Map(),
  };

  // 1) Siapkan semua badge lebih dulu agar commit judul tidak bolak-balik DB.
  const badgeIdCache = await prepareBadges(rows, result);

  // 2) Susun seluruh perubahan di memori dulu, lalu tulis dalam operasi bulk.
  //    Satu transaksi per baris terlalu lambat untuk ratusan judul (spec L12).
  const toAdd: Title[] = [];
  const toPut: Title[] = [];
  const toUpdate: { id: string; patch: Partial<Title> }[] = [];
  const badgeLinks: { titleId: string; badgeId: string }[] = [];
  /** titleId yang badge-nya harus dibuang dulu (khusus Replace). */
  const badgeResets: string[] = [];

  for (const row of rows) {
    if (row.status === 'needsReview' || row.action === 'skip') {
      result.skipped++;
      continue;
    }

    const badgeIds = collectBadgeIds(row.parsed, badgeIdCache);

    if (row.existing && row.action === 'merge') {
      const patch = mergeIntoExisting(row.existing, row.parsed);
      toUpdate.push({ id: row.existing.id, patch });
      // badge digabung (union), tidak pernah melepas badge existing
      for (const badgeId of badgeIds) badgeLinks.push({ titleId: row.existing.id, badgeId });
      if (row.parsed.coverFile) result.coverHints.set(row.existing.id, row.parsed.coverFile);
      result.merged++;
      continue;
    }

    if (row.existing && row.action === 'replace') {
      const record = toTitle(row.parsed, row.existing.id, row.existing.createdAt);
      // Replace menimpa record lama; cover existing dipertahankan bila import tak punya cover
      record.coverId = row.existing.coverId;
      toPut.push(record);
      badgeResets.push(record.id);
      for (const badgeId of badgeIds) badgeLinks.push({ titleId: record.id, badgeId });
      if (row.parsed.coverFile) result.coverHints.set(record.id, row.parsed.coverFile);
      result.replaced++;
      continue;
    }

    // judul baru
    const record = toTitle(row.parsed, newId());
    toAdd.push(record);
    for (const badgeId of badgeIds) badgeLinks.push({ titleId: record.id, badgeId });
    if (row.parsed.coverFile) result.coverHints.set(record.id, row.parsed.coverFile);
    result.inserted++;
  }

  await db.transaction('rw', db.titles, db.titleBadges, async () => {
    if (badgeResets.length > 0) {
      await db.titleBadges.where('titleId').anyOf(badgeResets).delete();
    }
    if (toAdd.length > 0) await db.titles.bulkAdd(toAdd);
    if (toPut.length > 0) await db.titles.bulkPut(toPut);
    for (const { id, patch } of toUpdate) await db.titles.update(id, patch);
    if (badgeLinks.length > 0) await db.titleBadges.bulkPut(badgeLinks);
  });

  return result;
}

/** `Kategori::nama badge` → badgeId. */
type BadgeCache = Map<string, string>;

async function prepareBadges(rows: PreviewRow[], result: CommitResult): Promise<BadgeCache> {
  const needed = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.status === 'needsReview' || row.action === 'skip') continue;
    for (const [category, names] of Object.entries(row.parsed.badgesByCategory)) {
      if (names.length === 0) continue;
      const set = needed.get(category) ?? new Set<string>();
      names.forEach((n) => set.add(n));
      needed.set(category, set);
    }
  }

  const cache: BadgeCache = new Map();
  if (needed.size === 0) return cache;

  // Baca sekali, tulis sekali: import genre/tema bisa menyentuh ratusan badge.
  const categories = await db.badgeCategories.toArray();
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id] as const));
  const newCategories: BadgeCategory[] = [];
  let order = categories.length;
  for (const category of needed.keys()) {
    if (categoryIdByName.has(category)) continue;
    const id = newId();
    categoryIdByName.set(category, id);
    newCategories.push({ id, name: category, order: order++ });
  }

  const existingBadges = await db.badges.toArray();
  const badgeIdByKey = new Map<string, string>(
    existingBadges.map((b) => [`${b.categoryId}::${b.name.toLowerCase()}`, b.id] as const),
  );
  const newBadges: Badge[] = [];
  const now = Date.now();

  for (const [category, names] of needed) {
    const categoryId = categoryIdByName.get(category)!;
    for (const name of names) {
      const key = `${categoryId}::${name.toLowerCase()}`;
      let badgeId = badgeIdByKey.get(key);
      if (!badgeId) {
        badgeId = newId();
        badgeIdByKey.set(key, badgeId);
        newBadges.push({ id: badgeId, name, categoryId, createdAt: now });
      }
      cache.set(`${category}::${name.toLowerCase()}`, badgeId);
    }
  }

  await db.transaction('rw', db.badgeCategories, db.badges, async () => {
    if (newCategories.length > 0) await db.badgeCategories.bulkAdd(newCategories);
    if (newBadges.length > 0) await db.badges.bulkAdd(newBadges);
  });

  result.badgesCreated = newBadges.length;
  return cache;
}

function collectBadgeIds(parsed: ParsedTitle, cache: BadgeCache): string[] {
  const ids = new Set<string>();
  for (const [category, names] of Object.entries(parsed.badgesByCategory)) {
    for (const name of names) {
      const id = cache.get(`${category}::${name.toLowerCase()}`);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

function toTitle(parsed: ParsedTitle, id: string, createdAt?: number): Title {
  const base = emptyTitle(id);
  return {
    ...base,
    createdAt: createdAt ?? base.createdAt,
    title: parsed.title,
    titleKo: parsed.titleKo,
    altTitles: parsed.altTitles,
    readUrls: parsed.readUrls,
    // req L128 — nilai awal hasil import
    tier: IMPORT_DEFAULT_TIER,
    favorite: false,
    readingStatus: 'belum_baca',
    workStatus: parsed.workStatus,
    statusRaw: parsed.statusRaw,
    type: parsed.type,
    yearOriginal: parsed.yearOriginal,
    yearIndo: parsed.yearIndo,
    authors: parsed.authors,
    scoreAnilist: parsed.scoreAnilist,
    scoreMangaupdates: parsed.scoreMangaupdates,
    indoChapters: parsed.indoChapters,
    indoStatus: parsed.indoStatus,
    synopsisId: parsed.synopsisId,
    synopsisEn: parsed.synopsisEn,
  };
}
