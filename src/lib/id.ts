/** id generator — spec §1 (`nanoid`/`crypto.randomUUID`). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalisasi kunci untuk dedup — spec §4 L152:
 * lower-case, trim, buang diakritik & tanda baca, samakan whitespace.
 */
export function normalizeKey(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** slug untuk cover matcher — spec §5 L161. */
export function slugify(input: string): string {
  return normalizeKey(input).replace(/\s+/g, '-');
}

/** Buang prefix indeks `NN-` pada nama file cover — spec §5 L161. */
export function stripIndexPrefix(slug: string): string {
  return slug.replace(/^\d+[-_]/, '');
}
