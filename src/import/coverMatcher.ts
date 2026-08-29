import { db } from '../db/db';
import type { Title } from '../db/types';
import { putCover, revokeCoverUrl } from '../lib/coverCache';
import { slugify, stripIndexPrefix } from '../lib/id';

/**
 * Cover Matcher — spec §5 (L158–L165), req FR-17.
 * Cocokkan nama file (tanpa ekstensi) ke slug(title)/slug(titleKo)/slug(altTitles).
 * Toleran prefix indeks `NN-`; ekstensi campur (.jpg/.png/.webp) via file.type.
 * Fuzzy hanya untuk near-match dengan ambang tinggi agar aman.
 */
const FUZZY_THRESHOLD = 0.88;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

export interface CoverCandidate {
  /** Nama path relatif, mis. `list1/01-the-undefeatable-swordsman.png`. */
  path: string;
  blob: Blob;
  mime: string;
}

export interface CoverMatch {
  candidate: CoverCandidate;
  titleId: string;
  titleName: string;
  score: number;
  /** true bila cocok lewat `cover_file` hint dari CSV/JSON (bukan slug). */
  viaHint: boolean;
}

export interface CoverMatchResult {
  matched: CoverMatch[];
  unmatched: CoverCandidate[];
}

/** Bongkar input: file gambar biasa dan/atau ZIP (spec L160). */
export async function collectCandidates(files: File[]): Promise<CoverCandidate[]> {
  const out: CoverCandidate[] = [];

  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
      // jszip di-load on-demand: hanya perlu saat pengguna benar-benar impor ZIP
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((e) => !e.dir && IMAGE_RE.test(e.name));
      for (const entry of entries) {
        const blob = await entry.async('blob');
        out.push({ path: entry.name, blob, mime: mimeFromName(entry.name) });
      }
      continue;
    }

    if (!IMAGE_RE.test(file.name) && !file.type.startsWith('image/')) continue;
    // webkitRelativePath ada saat pengguna memilih folder (mis. covers/list1/…)
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    out.push({
      path: rel && rel.length > 0 ? rel : file.name,
      blob: file,
      mime: file.type || mimeFromName(file.name),
    });
  }

  return out;
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

/** Ambil `list1/01-nama.png` → `list1/01-nama.png` dinormalisasi untuk cocok hint. */
function normalizeHintPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  // simpan maksimal 2 segmen terakhir (listN/file.ext) agar cocok dengan cover_file
  return parts.slice(-2).join('/').toLowerCase();
}

function baseSlug(path: string): string {
  const file = path.replace(/\\/g, '/').split('/').pop() ?? path;
  const noExt = file.replace(/\.[^.]+$/, '');
  return stripIndexPrefix(slugify(noExt));
}

/**
 * Kemiripan berbasis Levenshtein ternormalisasi (0..1).
 * Dipakai hanya sebagai fallback near-match dengan ambang tinggi.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) / maxLen > 1 - FUZZY_THRESHOLD) return 0;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    prev = curr;
  }
  const distance = prev[b.length] ?? maxLen;
  return 1 - distance / maxLen;
}

/**
 * Cocokkan kandidat ke judul di library.
 * `coverHints` (titleId → cover_file) dari hasil commit import dipakai lebih dulu
 * karena eksak; sisanya lewat slug lalu fuzzy.
 */
export async function matchCovers(
  candidates: CoverCandidate[],
  coverHints?: Map<string, string>,
): Promise<CoverMatchResult> {
  const titles = await db.titles.toArray();

  // index hint: cover_file ternormalisasi → titleId
  const hintIndex = new Map<string, string>();
  if (coverHints) {
    for (const [titleId, path] of coverHints) {
      hintIndex.set(normalizeHintPath(path), titleId);
    }
  }

  // index slug → titleId (judul, judul Korea, alt titles)
  const slugIndex = new Map<string, string>();
  const slugList: { slug: string; titleId: string }[] = [];
  for (const t of titles) {
    for (const name of [t.title, t.titleKo ?? '', ...t.altTitles]) {
      const s = slugify(name);
      if (!s) continue;
      if (!slugIndex.has(s)) slugIndex.set(s, t.id);
      slugList.push({ slug: s, titleId: t.id });
    }
  }

  const nameById = new Map(titles.map((t) => [t.id, t.title] as const));
  const matched: CoverMatch[] = [];
  const unmatched: CoverCandidate[] = [];
  const usedTitles = new Set<string>();

  for (const candidate of candidates) {
    const hintId = hintIndex.get(normalizeHintPath(candidate.path));
    if (hintId && !usedTitles.has(hintId)) {
      usedTitles.add(hintId);
      matched.push({
        candidate,
        titleId: hintId,
        titleName: nameById.get(hintId) ?? '',
        score: 1,
        viaHint: true,
      });
      continue;
    }

    const slug = baseSlug(candidate.path);
    const exactId = slugIndex.get(slug);
    if (exactId && !usedTitles.has(exactId)) {
      usedTitles.add(exactId);
      matched.push({
        candidate,
        titleId: exactId,
        titleName: nameById.get(exactId) ?? '',
        score: 1,
        viaHint: false,
      });
      continue;
    }

    // fuzzy near-match, ambang tinggi (spec L161)
    let best: { titleId: string; score: number } | null = null;
    for (const entry of slugList) {
      if (usedTitles.has(entry.titleId)) continue;
      const score = similarity(slug, entry.slug);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
        best = { titleId: entry.titleId, score };
      }
    }

    if (best) {
      usedTitles.add(best.titleId);
      matched.push({
        candidate,
        titleId: best.titleId,
        titleName: nameById.get(best.titleId) ?? '',
        score: best.score,
        viaHint: false,
      });
    } else {
      unmatched.push(candidate);
    }
  }

  return { matched, unmatched };
}

/** Simpan Blob ke store covers & set title.coverId (spec L163). */
export async function applyCoverMatches(matches: CoverMatch[]): Promise<number> {
  let applied = 0;
  for (const m of matches) {
    const title: Title | undefined = await db.titles.get(m.titleId);
    if (!title) continue;
    const oldCoverId = title.coverId;
    const coverId = await putCover(m.candidate.blob, m.candidate.mime);
    await db.titles.update(m.titleId, { coverId, updatedAt: Date.now() });
    if (oldCoverId) {
      await db.covers.delete(oldCoverId);
      revokeCoverUrl(oldCoverId);
    }
    applied++;
  }
  return applied;
}
