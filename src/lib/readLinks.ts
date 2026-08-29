import type { ReadLink, ReadSource } from '../db/types';

/**
 * Link baca — spec L60–L67, req FR-22.
 * Source diturunkan dari host; judul tanpa link menampilkan empty state (design §4).
 */
const SOURCE_LABEL: Record<ReadSource, string> = {
  komiku: 'Komiku',
  bacakomik: 'BacaKomik',
  other: 'Sumber lain',
};

export function sourceFromUrl(url: string): ReadSource {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // URL tak valid → jangan crash (NFR-08)
    host = url.toLowerCase();
  }
  if (host.includes('komiku')) return 'komiku';
  if (host.includes('bacakomik')) return 'bacakomik';
  return 'other';
}

/** Label tombol "Read ↗ <sumber>" — design §5-4. */
export function readLinkLabel(link: ReadLink): string {
  if (link.label) return link.label;
  if (link.source === 'other') {
    try {
      return new URL(link.url).hostname.replace(/^www\./, '');
    } catch {
      return SOURCE_LABEL.other;
    }
  }
  return SOURCE_LABEL[link.source];
}

export function makeReadLink(url: string, label?: string): ReadLink {
  const clean = url.trim();
  return label ? { url: clean, source: sourceFromUrl(clean), label } : { url: clean, source: sourceFromUrl(clean) };
}

/** Bangun readUrls dari beberapa kolom/URL; buang kosong & duplikat URL (spec L121, L156). */
export function buildReadLinks(urls: (string | null | undefined)[]): ReadLink[] {
  const seen = new Set<string>();
  const out: ReadLink[] = [];
  for (const raw of urls) {
    const url = (raw ?? '').trim();
    if (!url) continue;
    const key = url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(makeReadLink(url));
  }
  return out;
}

/** Union link berdasarkan URL — dipakai Merge saat import (spec L156). */
export function mergeReadLinks(existing: ReadLink[], incoming: ReadLink[]): ReadLink[] {
  const seen = new Set(existing.map((l) => l.url.replace(/\/+$/, '').toLowerCase()));
  const out = [...existing];
  for (const link of incoming) {
    const key = link.url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}
