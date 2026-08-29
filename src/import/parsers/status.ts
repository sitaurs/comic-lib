import type { WorkStatus } from '../../db/types';

/**
 * Status normalizer — spec §3.5 (L137–L149).
 * Ambil isi kurung PERTAMA pada statusRaw, lower-case, cocokkan substring
 * dengan prioritas: cancel → drop → hiatus → complete → ongoing.
 *
 * Raw kadang terpotong (`(Complet`, `(C)`) sehingga kurung penutup bisa hilang —
 * dalam kasus itu ambil sisa string setelah `(` (NFR-08: jangan crash).
 */
export function normalizeWorkStatus(statusRaw: string | null | undefined): WorkStatus {
  if (!statusRaw) return 'unknown';

  const open = statusRaw.indexOf('(');
  let inner: string;
  if (open === -1) {
    // tidak ada kurung → cocokkan seluruh string
    inner = statusRaw;
  } else {
    const close = statusRaw.indexOf(')', open + 1);
    inner = close === -1 ? statusRaw.slice(open + 1) : statusRaw.slice(open + 1, close);
  }

  const s = inner.toLowerCase();

  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('drop')) return 'dropped';
  if (s.includes('hiatus')) return 'hiatus';
  if (s.includes('complet')) return 'complete'; // menangkap "Complet" terpotong
  if (s.includes('ongoing')) return 'ongoing';

  return 'unknown';
}
