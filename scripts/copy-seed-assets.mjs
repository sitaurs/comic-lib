import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Salin aset seed ke `dist/` setelah `vite build`.
 *
 * Kenapa tidak ditaruh di `public/`: Vite menyalin seluruh `public/` apa adanya,
 * jadi 18 MB cover akan terduplikasi di repo. Menyalin di sini juga membuat
 * cover berada DI LUAR precache service worker — sw.js sudah dibuat pada tahap
 * `vite build` sebelum skrip ini jalan, sehingga app shell tetap ringan.
 * Cover tidak perlu di-precache karena setelah seed ia tersimpan sebagai Blob
 * di IndexedDB (spec §2), jadi offline tetap jalan.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const items = [
  ['data/library.csv', 'data/library.csv'],
  ['covers-manifest.json', 'covers-manifest.json'],
  ['covers', 'covers'],
];

for (const [from, to] of items) {
  const dest = resolve(dist, to);
  await mkdir(dirname(dest), { recursive: true });
  await cp(resolve(root, from), dest, { recursive: true });
  console.log(`[seed-assets] ${from} → dist/${to}`);
}
