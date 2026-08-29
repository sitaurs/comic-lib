# Plan — Manhwa Library (Roadmap Implementasi)

Roadmap implementasi bertahap. Detail kebutuhan di [requirement.md](requirement.md), teknis di [spec.md](spec.md), UI/UX di [design.md](design.md).

## Ringkasan

Aplikasi library manhwa/manga pribadi, **local-first** (IndexedDB, offline, PWA), tanpa server/login. Stack: **React + Vite + TypeScript + Tailwind + Dexie + Zustand + vite-plugin-pwa**. App mulai kosong; data masuk lewat Manual Add / Bulk Import. Cover disimpan sebagai Blob di IndexedDB. Genre & tema saat import otomatis jadi badge berkategori.

## Sumber Data

| File | Judul | Catatan |
|---|---|---|
| `data/library.csv` | **118** | Format utama (22 kolom), ada `judul_korea` + `link_baca_1/2/3` |
| `data/metadata.csv` | 85 | Format lama (19 kolom), ada `tahun_indo` |
| `data/metadata.json` | 85 | Punya `source_url` (72 komiku + 13 bacakomik) |
| `data/list-manhwa-asli.txt` | 85 | 1 URL baca per entri |
| `covers/list1..4` | 118 cover | 30+30+25+33 |

**Status scraping (29 Agu 2026)**: kolom `link_baca_1/2/3` di `library.csv` masih kosong (URL baca sedang di-scrape di proses lain). Model data memakai `readUrls[]` sehingga siap terisi; sementara itu URL bisa dilengkapi lewat import **Merge** dari `metadata.json`/TXT.

## Fase Implementasi

### Fase 1 — Fondasi
- Scaffold Vite + React + TS + Tailwind.
- Terapkan token design ([design.md](design.md)) ke `tailwind.config` (`src/design/tokens.ts`).
- Dexie schema + migrasi + seed kategori default "Genre"/"Tema" (`src/db/`).
- Zustand stores (`libraryStore`, `filterStore`, `badgeStore`, `uiStore`).
- Routing + app shell: nav desktop (Home · Library · Collections · Badges · Settings) + bottom nav mobile.
- Komponen UI dasar: Button (primary amber / secondary / ghost), Chip, TierChip, Modal (glass), BottomSheet, Toast.

### Fase 2 — Library Core
- Grid + Compact view, kartu cover (hover zoom + gradient, tier chip + status dot).
- Search + sort.
- Manual Add (form lengkap FR-13).
- Edit inline read/unread, favorite, tier dari kartu.
- Quick Edit popover (FR-21).

### Fase 3 — Badge System
- Badge Manager: kategori, CRUD badge, usage count, Rename/Move/Merge/Delete.
- Quick Badge Selector (searchable, buat baru inline).
- Klik badge → filter library.

### Fase 4 — Import
- Parser CSV `library.csv` (22 kolom, `judul_korea`, `link_baca_1/2/3` → `readUrls[]`) + format lama CSV/JSON/TXT + normalisasi status + genre→badge.
- Import Preview (detected/valid/duplicates/needs review) + dedup Skip/Replace/Merge (Merge menggabungkan `readUrls`).
- Bulk Cover Import (gambar/ZIP + slug matcher).
- **Validasi dengan dataset asli** (`data/library.csv` 118 judul + `covers/list1..4` 118 cover).

### Fase 5 — Filter & Views
- Advanced Filter (Include/Exclude, Match ALL/ANY, "Show N titles").
- Tier View (baris SS→Unrated).
- Collections (CRUD + membership).
- Bulk Edit multi-select + mobile Action Bar.

### Fase 6 — Home, Backup, PWA & Polish
- Home (stat tiles + cover rows + Random Pick).
- Detail page tab lengkap (Description/Reading Progress/Collections/Badges/History/Metadata).
- Backup/Restore (Export JSON+ZIP + CSV, Restore penuh).
- PWA (manifest + service worker, installable, offline).
- Polish: empty states, toast, bottom sheet mobile, responsif.

## Prioritas MVP

Fase 1–5 (minus Tier View & Home yang bisa menyusul) membentuk MVP: Library, Manual Add, Bulk Import, Tier, Read/Unread, Favorite, Badge Manager + Filter, Collections, Bulk Edit, Cover Import, Backup/Restore.

## Verifikasi

- Import `library.csv` → 118 judul benar (`judul_korea` terisi, `link_baca_*` kosong → `readUrls: []`, split ` | ` alt title); format lama CSV/JSON/TXT → 85 judul (Unicode, raw terpotong, status ganda, coercion tahun).
- Merge dari `metadata.json`/TXT mengisi `readUrls` tanpa menimpa tier/favorit/badge.
- Cover matcher: `covers/list1..4` → 118 ter-link.
- Backup → wipe → restore identik (offline), termasuk `readUrls` & `titleKo`.
- `tsc --noEmit` + `npm run build` bersih; Lighthouse PWA installable & offline pass.
- Smoke test filter Include/Exclude + Match ALL/ANY dengan data nyata.
