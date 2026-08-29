import { db } from '../db/db';
import { seedDefaultCategories } from '../db/seed';
import { detectAndParse } from '../import/detect';
import { buildPreview } from '../import/dedupe';
import { commitImport } from '../import/commit';
import {
  applyCoverMatches,
  collectCandidates,
  matchCovers,
} from '../import/coverMatcher';

/**
 * Seeder khusus mode dev — memuat `data/library.csv` (118 judul) + `covers/list1..4`
 * (118 cover) langsung dari repo lewat fetch, lalu menjalankan pipeline import
 * yang sama seperti UI Settings (parse → preview → commit → cover match).
 *
 * Hanya untuk uji manual; file ini tidak dipakai di build produksi
 * (aset `data/` & `covers/` tidak ikut dibundel).
 */
export interface SeedReport {
  wiped: boolean;
  detected: number;
  inserted: number;
  merged: number;
  replaced: number;
  skipped: number;
  badgesCreated: number;
  coversMatched: number;
  coversUnmatched: number;
  coversStored: number;
}

const CSV_PATH = '/data/library.csv';
const COVER_MANIFEST = '/covers-manifest.json';

async function fetchText(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Gagal memuat ${path} (${res.status})`);
  return res.text();
}

/** Ambil tiap cover dari disk dev-server dan bungkus jadi File seperti file picker. */
async function fetchCoverFiles(): Promise<File[]> {
  const paths = JSON.parse(await fetchText(COVER_MANIFEST)) as string[];
  const files: File[] = [];
  for (const rel of paths) {
    const res = await fetch(`/covers/${rel}`);
    if (!res.ok) continue;
    const blob = await res.blob();
    const name = rel.slice(rel.lastIndexOf('/') + 1);
    const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const file = new File([blob], name, { type: mime });
    // browser mengisi webkitRelativePath saat folder dipilih — matcher memakainya
    Object.defineProperty(file, 'webkitRelativePath', { value: `covers/${rel}` });
    files.push(file);
  }
  return files;
}

/** Kosongkan seluruh tabel (berurutan; paralel bikin transaksi Dexie bentrok). */
async function wipeAll(): Promise<void> {
  for (const table of db.tables) await table.clear();
  await seedDefaultCategories();
}

export async function seedFromDisk({ wipe = true } = {}): Promise<SeedReport> {
  if (wipe) await wipeAll();
  else await seedDefaultCategories();

  const parsed = detectAndParse(await fetchText(CSV_PATH), 'library.csv');
  const preview = await buildPreview(parsed.titles);
  const commit = await commitImport(preview);

  const candidates = await collectCandidates(await fetchCoverFiles());
  const match = await matchCovers(candidates, commit.coverHints);
  const stored = await applyCoverMatches(match.matched);

  return {
    wiped: wipe,
    detected: parsed.detected,
    inserted: commit.inserted,
    merged: commit.merged,
    replaced: commit.replaced,
    skipped: commit.skipped,
    badgesCreated: commit.badgesCreated,
    coversMatched: match.matched.length,
    coversUnmatched: match.unmatched.length,
    coversStored: stored,
  };
}

/**
 * Isi otomatis saat rak masih kosong — IndexedDB terisolasi per profil browser,
 * jadi tiap browser/profil baru perlu di-seed sendiri. Idempoten: sekali rak
 * berisi judul, fungsi ini tidak melakukan apa pun.
 */
export async function autoSeedIfEmpty(): Promise<SeedReport | null> {
  if ((await db.titles.count()) > 0) return null;
  const report = await seedFromDisk({ wipe: false });
  return report;
}

