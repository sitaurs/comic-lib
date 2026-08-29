# Todos — Manhwa Library

Daftar tugas implementasi, diturunkan dari [requirement.md](requirement.md), [spec.md](spec.md), [design.md](design.md), dan [plan.md](plan.md). Tiap tugas menyertakan rujukan sumber (baris `L..` atau pin section `§`).

## Legenda Status
- ⬜ **Belum Dikerjakan**
- 🔄 **Proses**
- ✅ **Completed**
- ✅✅ **Completed Verified** (sudah dites & lolos verifikasi)

## Konvensi Rujukan
- `req Lxx–Lyy` = [requirement.md](requirement.md) baris xx–yy
- `spec Lxx–Lyy` = [spec.md](spec.md) baris xx–yy
- `design §n` = [design.md](design.md) section nomor n
- `plan §Fase-n` = [plan.md](plan.md) fase n

---

## Fase 0 — Dokumentasi
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 0.1 | Tulis requirement.md | ✅ | seluruh [requirement.md](requirement.md) |
| 0.2 | Tulis spec.md | ✅ | seluruh [spec.md](spec.md) |
| 0.3 | Tulis design.md | ✅ | seluruh [design.md](design.md) |
| 0.4 | Tulis plan.md | ✅ | seluruh [plan.md](plan.md) |
| 0.5 | Tulis todos.md | ✅ | dokumen ini |

---

## Fase 1 — Fondasi (`plan §Fase-1`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 1.1 | Scaffold Vite + React 18 + TypeScript | ✅✅ | spec L5–L12 |
| 1.2 | Setup Tailwind + token warna/tipografi (`src/design/tokens.ts`, extend `tailwind.config`) | ✅✅ | design §2, §3, §9 · spec L8 |
| 1.3 | Dexie schema v1 semua store + index (`src/db/`) | ✅✅ | spec L14–L29 |
| 1.4 | Definisi tipe entity (Title + `titleKo`/`readUrls[]`, Badge, Category, Collection, Cover, join) | ✅✅ | spec L30–L83 |
| 1.5 | Seed kategori badge default "Genre" & "Tema" | ✅✅ | spec L136 · req L50 (FR-08) |
| 1.6 | Zustand stores: libraryStore, filterStore, badgeStore, uiStore | ✅✅ | spec L198–L205 |
| 1.7 | Routing + app shell: nav desktop (Home·Library·Collections·Badges·Settings) | ✅✅ | design §7 |
| 1.8 | Bottom nav mobile | ✅✅ | design §6 |
| 1.9 | Komponen UI dasar: Button (primary amber/secondary/ghost), Chip, TierChip | ✅✅ | design §4 |
| 1.10 | Komponen UI: Modal (glass), BottomSheet, Toast | ✅✅ | design §4 |
| 1.11 | Utilitas cover: cache `coverId → objectURL` + revoke | ✅✅ | spec L82 |

---

## Fase 2 — Library Core (`plan §Fase-2`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 2.1 | Library grid — mode Grid & Compact | ✅ | req L24–L26 (FR-01) · design §5-2 |
| 2.2 | Kartu cover: hover zoom + gradient overlay, tier chip, status dot | ✅ | design §5-2, §8 · req L26 |
| 2.3 | Search (judul + judul Korea + altTitles) + Sort (judul/recent/tier/tahun) | ✅ | req L26 (FR-01) · spec L179, L189 |
| 2.4 | Manual Add (form: cover, judul, judul Korea, link baca 1..n, status, tier, favorit, badge, workStatus, deskripsi) | ✅ | req L64–L65 (FR-13) |
| 2.5 | Reading status Pernah/Belum Baca (edit inline, default Belum Baca) | ✅ | req L28–L29 (FR-02) |
| 2.6 | Tier SS–D/Unrated (set inline, default Unrated, warna) | ✅ | req L31–L33 (FR-03) · design §2 |
| 2.7 | Favorite toggle ♥ | ✅ | req L35–L36 (FR-04) |
| 2.8 | Quick Edit popover (status/tier/favorit/badge) | ✅ | req L88–L89 (FR-21) · design §5-7 |
| 2.9 | Read Link jamak — tombol "Read ↗" per sumber + empty state bila belum ada link | ✅ | req L91–L92 (FR-22) · spec L60–L67 · design §4, §5-4 |
| 2.10 | Performa grid 500+ judul (virtualisasi + lazy cover) | ✅ | req L119 (NFR-03) · spec L12 |

---

## Fase 3 — Badge System (`plan §Fase-3`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 3.1 | Custom Badges — pasang/lepas ke judul (many-to-many via titleBadges) | ✅ | req L38–L40 (FR-05) · spec L23, L69 |
| 3.2 | Badge Manager — CRUD badge & kategori | ✅ | req L42–L44 (FR-06) |
| 3.3 | Badge Manager — usage count | ✅ | req L44 · spec L175 |
| 3.4 | Badge Manager — Rename/Move/Merge/Delete | ✅ | req L44 (FR-06) · design §5-6 |
| 3.5 | Custom Badge Categories (buat kategori, MC/Cerita/Action/Comedy) | ✅ | req L49–L50 (FR-08) |
| 3.6 | Quick Badge Selector (searchable, buat baru inline) | ✅ | req L46–L47 (FR-07) |
| 3.7 | Klik badge → filter library | ✅ | req L58–L59 (FR-11) · spec L163 |

---

## Fase 4 — Import (`plan §Fase-4`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 4.1 | Parser CSV **`library.csv`** (22 kolom, `judul_korea`, `link_baca_1/2/3`→`readUrls[]`, split ` \| ` alt title) | ✅✅ | spec L114–L125 |
| 4.2 | Parser CSV lama `metadata.csv` (19 kolom, `tahun_indo`) | ✅✅ | spec L126–L128 |
| 4.3 | Parser JSON (28-key, coerce year_original, `source_url`→`readUrls[0]`) | ✅✅ | spec L129–L136 |
| 4.4 | Parser TXT (2-baris, header section, nested paren, raw terpotong, Unicode, status ganda) | ✅✅ | spec L99–L113 · req L124 (NFR-08) |
| 4.5 | Status normalizer → workStatus (~9 varian) | ✅✅ | spec L137–L149 |
| 4.6 | Genre/Tema → badge berkategori otomatis | ✅ | spec L120, L136 · req L137 |
| 4.7 | Duplicate Detection (normalisasi judul+titleKo+alt, Skip/Replace/Merge) | ✅✅ | req L73–L74 (FR-16) · spec L150–L157 |
| 4.8 | Merge mengisi `readUrls` dari JSON/TXT tanpa timpa tier/favorit/badge | ✅✅ | spec L156–L157 |
| 4.9 | Import Preview (detected/valid/duplicates/needs review) | ✅ | req L70–L71 (FR-15) · spec L155 |
| 4.10 | Bulk Cover Import (gambar/ZIP, slug matcher, ekstensi campur) | ✅✅ | req L76–L77 (FR-17) · spec L158–L165 |
| 4.11 | Validasi importer: `library.csv` 118 judul + `covers/list1..4` 118 cover | ✅✅ | spec L213–L219 · req L128–L137 |

---

## Fase 5 — Filter & Views (`plan §Fase-5`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 5.1 | Advanced Filter — Include/Exclude (badge/tier/status/favorit) + "Show N titles" + Clear | ✅ | req L52–L53 (FR-09) · spec L166–L190 · design §5-3 |
| 5.2 | Match ALL / ANY untuk badge | ✅ | req L55–L56 (FR-10) · spec L186–L188 |
| 5.3 | Tier View (baris SS→Unrated + jumlah) | ✅ | req L61–L62 (FR-12) · design §5-5 |
| 5.4 | Collections — CRUD + membership many-to-many | ✅ | req L82–L83 (FR-19) · spec L25, L70 |
| 5.5 | Bulk Edit multi-select (mark read, add badge, set tier, add to collection) | ✅ | req L79–L80 (FR-18) |
| 5.6 | Mobile Action Bar "N Selected" | ✅ | design §6 |
| 5.7 | Mobile bottom sheet untuk Filter & Quick Edit | ✅ | design §6 · req L123 (NFR-07) |

---

## Fase 6 — Home, Detail, Backup, PWA & Polish (`plan §Fase-6`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| 6.1 | Home — stat tiles (Total/Favorites/SS/Belum Baca) + cover row Recently Added | ✅ | req L94–L95 (FR-23) · design §5-1 |
| 6.2 | Random Pick (semua/belum baca/SS–S/dari collection) | ✅ | req L97–L98 (FR-24) |
| 6.3 | Detail page + judul Korea + Read↗ per sumber + tab (Description/Collections/Badges/Metadata) | ✅ | req L85–L86 (FR-20) · design §5-4 |
| 6.4 | Backup/Restore — Export JSON+ZIP (semua data + cover) | ✅✅ | req L100–L101 (FR-25) · spec L192–L196 |
| 6.5 | Export CSV format `library.csv` (22 kolom) | ✅✅ | spec L195 |
| 6.6 | Restore penuh (validasi schemaVersion, transaksi) | ✅✅ | spec L196 |
| 6.7 | PWA — manifest + service worker (installable, offline) | ✅ | req L106–L107 (FR-27) · spec L207–L211 |
| 6.8 | Local-first check — tanpa jaringan/telemetri, persist storage | ✅ | req L103–L104 (FR-26), L117, L120 |
| 6.9 | Polish — empty states, toast, aksesibilitas, responsif | ✅ | design §4, §8 · req L122–L123 (NFR-06/07) |

---

## Verifikasi Global (`spec §10`)
| # | Tugas | Status | Rujukan |
|---|---|---|---|
| V.1 | Test parser `library.csv` → 118 judul (`judul_korea` terisi, `readUrls` 3/judul, split ` \| `) | ✅✅ | spec L215 |
| V.2 | Test parser format lama CSV/JSON/TXT → 85 judul (Unicode, raw terpotong, coerce tahun) | ✅✅ | spec L215 |
| V.3 | Test dedup + Merge mengisi `readUrls` tanpa timpa tier/favorit/badge | ✅✅ | spec L216 |
| V.4 | Test cover matcher `covers/list1..4` → 118 ter-link | ✅✅ | spec L217 |
| V.5 | Test backup → wipe → restore identik (termasuk `readUrls` & `titleKo`) | ✅✅ | spec L218 · `src/lib/backup.test.ts` |
| V.6 | `tsc --noEmit` + `npm run build` bersih | ✅✅ | spec L219 |
| V.7 | Lighthouse PWA installable & offline pass | 🔄 | spec L219 |
| V.8 | Smoke test filter Include/Exclude + Match ALL/ANY dengan data nyata | ✅✅ | plan §Verifikasi · `src/lib/filter.test.ts` |
| V.9 | Re-import setelah scraping selesai → `link_baca_*` terisi jadi `readUrls[]` | ✅✅ | spec L221 · req L137 |

---

## Catatan Status Data (29 Agu 2026)

- Sumber utama sekarang **`data/library.csv`**: 118 judul (list1=30, list2=30, list3=25, list4=33), 22 kolom.
- **Update 29 Agu 18:36 — scraping link selesai.** Kolom `link_baca_1/2/3` kini **terisi di seluruh 118 baris** (3 URL unik per judul; host teratas: komiku.org 98, bacakomik.my 85, komikindo.ch 74, plus ~25 host lain). Prasyarat V.9 sudah terpenuhi dan diuji lewat `parsers.test.ts`.
- `judul_korea` masih terisi 33/118 (baru list4).
- `covers/` berisi **118 cover** (termasuk `list4` yang sebelumnya belum bermetadata).

**Ringkasan progres:** Fase 0 ✅ · Fase 1 ✅✅ (11/11) · Fase 2 ✅ (10/10) · Fase 3 ✅ (7/7) · Fase 4 ✅ (11/11) · Fase 5 ✅ (7/7) · **Fase 6 ✅ (9/9)** · Verifikasi: V.1–V.6, V.8, V.9 ✅✅; V.7 (Lighthouse manual) 🔄.
Test suite: **51 test lolos** (`parsers` 23 · `pipeline` 10 · `coverMatcher` 4 · `filter` 7 · `backup` 7); `tsc --noEmit` bersih; `npm run build` sukses — 12 entri precache (603.28 KiB), jszip di-split jadi chunk on-demand 97.42 kB.

### Catatan Fase 6
- Home: `StatTiles` (4 tile Bento, klik → Library terfilter) · 4 `CoverRow` scroll horizontal (Recently Added / Favorites / Belum Baca / Top Tier SS–S, baris kosong disembunyikan) · `RandomPick` 🎲 dengan lingkup semua/belum baca/SS–S/collection.
- Backup: `src/lib/backup.ts` — `exportBackupZip()` (library.json + covers/ + manifest.json), `exportCsv()` (22 kolom, round-trip lewat `parseCsv`), `restoreBackupZip(file, 'merge'|'replace')` dengan validasi `schemaVersion` + satu transaksi Dexie. UI di `components/settings/BackupPanel.tsx` (replace butuh konfirmasi).
- PWA: `navigateFallback: 'index.html'` supaya deep-link (`/library`, `/title/:id`) tetap jalan offline; `cleanupOutdatedCaches`, manifest lengkap (scope, lang, orientation, kategori), apple-touch-icon.
- Local-first terverifikasi: nol `fetch`/`XMLHttpRequest`/WebSocket/telemetri di `src/`, nol aset pihak ketiga di `index.html`/CSS, `navigator.storage.persist()` dipanggil saat boot.
- A11y: skip-link ke `#main`, focus trap + pemulihan fokus di Modal/BottomSheet, tablist ARIA + navigasi ←/→ di halaman detail, nol hex mentah (semua warna via token design §9).

### Data Uji Termuat (dev)
- `src/dev/seedFromDisk.ts` — seeder khusus dev yang menjalankan pipeline import asli (`detectAndParse` → `buildPreview` → `commitImport` → `collectCandidates`/`matchCovers`/`applyCoverMatches`) langsung dari `data/library.csv` + `covers/list1..4` via fetch, memakai `covers-manifest.json` (118 path) sebagai daftar file.
- **`autoSeedIfEmpty()`** dipanggil saat boot di `src/main.tsx` (di balik `import.meta.env.DEV`): kalau `titles.count() === 0` rak diisi otomatis, kalau sudah ada data tidak melakukan apa pun. Perlu karena **IndexedDB terisolasi per browser/profil** — data yang di-seed di satu browser tidak terlihat di Chrome/Firefox lain. `window.__seed()` tetap tersedia di console untuk re-seed manual (wipe dulu); `__seed({ wipe: false })` untuk merge.
- Hasil eksekusi nyata: `{ detected: 118, inserted: 118, badgesCreated: 484, coversMatched: 118, coversStored: 118, coversUnmatched: 0 }` dalam ~2,1 s. Isi DB: titles 118 · badges 484 · badgeCategories 2 · titleBadges 1886 · covers 118.
- Terverifikasi di UI: Home ("118 judul di rak kamu", tile 118/0/0/118, cover row terisi) · Library ("118 judul", grid 2→8 kolom responsif) · Badges · halaman detail (mis. Doctor's Rebirth → 3 tombol `Read ↗` per sumber + 4 tab). Nol error console, layout mobile 375×812 rapi dengan bottom nav.

**Sisa:** V.7 harus dijalankan manual di browser (`npm run build && npm run preview`, lalu Lighthouse → kategori PWA, plus uji offline dengan DevTools ▸ Network ▸ Offline).
