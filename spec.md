# Spec Teknis — Manhwa Library

Spesifikasi teknis implementasi. Lihat [requirement.md](requirement.md) untuk kebutuhan dan [design.md](design.md) untuk UI/UX.

## 1. Tech Stack

- **React 18 + Vite + TypeScript** — SPA, build cepat.
- **Tailwind CSS** — styling; token warna/tipografi dari [design.md](design.md) di-extend ke `tailwind.config`.
- **Dexie.js** — wrapper IndexedDB (query, index, migration).
- **Zustand** — state management ringan.
- **vite-plugin-pwa** — manifest + service worker (installable, offline).
- **Pustaka pendukung**: `nanoid`/`crypto.randomUUID` (id), `papaparse` (CSV RFC-4180), `jszip` (ZIP import/backup), `fuse.js` atau matcher slug ringan (fuzzy cover match), `react-router` (routing), `react-window`/virtual (grid besar).

## 2. Data Model (Dexie schema)

Database `manhwa-library`. Store & index (`&` = primary key, `*` = multi-entry index):

```ts
db.version(1).stores({
  titles:          '&id, title, readingStatus, tier, favorite, workStatus, yearOriginal, createdAt, updatedAt, *altTitles',  badges:          '&id, name, categoryId, createdAt',
  badgeCategories: '&id, name, order',
  titleBadges:     '&[titleId+badgeId], titleId, badgeId',
  collections:     '&id, name, createdAt',
  titleCollections:'&[titleId+collectionId], titleId, collectionId',
  covers:          '&id',            // blob store, tidak perlu index lain
  meta:            '&key',
});
```

### Entity `Title`
```ts
interface Title {
  id: string;
  title: string;
  titleKo: string | null;           // judul Korea (kolom judul_korea)
  altTitles: string[];
  coverId: string | null;           // FK -> covers.id
  readUrls: ReadLink[];             // 0..n link baca (link_baca_1/2/3)
  readingStatus: 'pernah_baca' | 'belum_baca';
  tier: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'Unrated';
  favorite: boolean;
  workStatus: 'ongoing' | 'complete' | 'hiatus' | 'dropped' | 'cancelled' | 'unknown';
  description: string | null;
  // metadata opsional (dari import)
  type: 'Manhwa' | 'Manhua' | 'Manga' | null;
  yearOriginal: number | null;
  yearIndo: number | null;          // hanya ada di metadata.csv lama; null dari library.csv
  authors: string[];
  scoreAnilist: number | null;      // 0..100
  scoreMangaupdates: number | null; // 0..10
  statusRaw: string | null;         // teks mentah sumber
  totalChapters: number | null;     // `jumlah_chapter` — total chapter di sumber asli
  chapterSource: string | null;     // `chapter_sumber` — asal hitungan (MangaUpdates/AniList)
  indoChapters: number | null;      // hitungan chapter Indo (`chapter_indo` / TXT)
  indoStatus: 'TAMAT' | 'ONGOING' | null; // bracket TXT (sinyal terpisah)
  synopsisId: string | null;
  synopsisEn: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ReadLink {
  url: string;
  source: 'komiku' | 'bacakomik' | 'other'; // diturunkan dari host
  label?: string;                            // opsional, mis. "Mirror"
}
```

**Link baca jamak**: satu judul bisa punya beberapa sumber baca (`link_baca_1/2/3` di CSV). Model memakai array agar tidak terikat 3 kolom — TXT/JSON yang hanya punya 1 URL masuk sebagai array 1 elemen. Detail page menampilkan satu tombol "Read ↗" per link.

### Entity lain
```ts
interface Badge { id: string; name: string; categoryId: string; color?: string; createdAt: number; }
interface BadgeCategory { id: string; name: string; order: number; }
interface Collection { id: string; name: string; description?: string; coverTitleId?: string; createdAt: number; }
interface Cover { id: string; blob: Blob; mime: string; width?: number; height?: number; }
// join tables
interface TitleBadge { titleId: string; badgeId: string; }
interface TitleCollection { titleId: string; collectionId: string; }
```

**Prinsip relasi**: judul TIDAK menyimpan array badge/collection. Keanggotaan lewat tabel join → filter Include/Exclude & usage-count efisien, merge badge cukup update baris join.

**Cover**: disimpan sebagai Blob terpisah agar query judul ringan. UI render via `URL.createObjectURL(blob)` dan revoke saat unmount; cache map `coverId → objectURL` di memori.

## 3. Import — Format & Parser

Ada 3 sumber import; semua mengalir ke pipeline yang sama: **parse → normalisasi → dedup → preview → commit**.

**Sumber data proyek (acuan):**
| File | Judul | Catatan |
|---|---|---|
| `data/library.csv` | **118** (list1–4) | **Format utama**, 25 kolom, ada `judul_korea` + `link_baca_1/2/3` + 3 kolom hitungan chapter |
| `data/metadata.csv` | 85 (list1–3) | Format lama 19 kolom, ada `tahun_indo`, tanpa link baca |
| `data/metadata.json` | 85 (list1–3) | Punya `source_url` (1 URL baca per judul) |
| `data/list-manhwa-asli.txt` | 85 (list1–3) | 1 URL baca per entri |
| `covers/list1..4` | **118 cover** | 30+30+25+33; `list4` belum bermetadata di file lama |

Strategi yang disarankan: import **library.csv** dulu (118 judul + cover), lalu **Merge** dari `metadata.json`/TXT untuk melengkapi URL baca sampai kolom `link_baca_*` selesai di-scrape.

### 3.1 TXT (`list-manhwa-asli.txt`)
Struktur: 3 section dengan header `=== LIST n — ... ===`, numbering restart per section, tiap entri **2 baris**:
```
<n>. <Title> — Indo <NNN>ch [TAMAT|ONGOING] (raw: <status mentah>)
   <URL>
```
Aturan parser:
- Deteksi header section via regex `^===\s*LIST\s*(\d+)`.
- Baris entri: `^\s*(\d+)\.\s+(.+?)\s+—\s+Indo\s+(\d+)ch\s+\[(TAMAT|ONGOING)\]\s*\(raw:\s*(.*)$`.
- **Nested paren di `(raw: ...)`**: JANGAN pakai `\)` non-greedy — ambil sisa baris sampai EOL lalu buang `)` penutup terakhir bila ada. Raw kadang terpotong (`(Complet`, `(C)`); simpan apa adanya ke `statusRaw`.
- Baris URL: baris berikut yang ter-indentasi berisi satu URL → `readUrl` + `source` (dari host).
- Judul mengandung Unicode (`’`, en-dash `–`, `:`) — jangan strip.
- Simpan **dua sinyal status independen**: `indoStatus` (bracket) & `workStatus` (hasil normalisasi `statusRaw`) — keduanya bisa berbeda.
- `indoChapters` dari `Indo NNNch` berbeda dari chapter sumber; keduanya dipertahankan.

### 3.2 CSV — `library.csv` (format utama, 25 kolom)
Sumber import **utama**. Header (urut tetap):
```
list,no,judul,judul_korea,judul_alternatif,genre_terverifikasi,genre_1sumber,tema,tahun_asli,tipe,status,jumlah_chapter,chapter_indo,chapter_sumber,author,skor_anilist,skor_mangaupdates,skor_mal,sumber,cover_file,link_baca_1,link_baca_2,link_baca_3,sinopsis_id,sinopsis_en
```
- **Update 29 Agu 2026:** 3 kolom hitungan chapter disisipkan setelah `status` (dulu 22 kolom): `jumlah_chapter` (terisi 117/118 — kosong di *The Executioner*), `chapter_indo` (118/118), `chapter_sumber` (117/118; `MangaUpdates+AniList` 58, `MangaUpdates` 57). Mapping: `jumlah_chapter→totalChapters`, `chapter_indo→indoChapters`, `chapter_sumber→chapterSource`. Ini **metadata katalog** (total chapter tersedia di sumber), **bukan progress baca** — status baca tetap biner (design §4). `metadata.csv` lama tidak punya ketiganya → ketiga field `null`.
- **118 judul**: list1=30, list2=30, list3=25, **list4=33**.
- Gunakan **parser RFC-4180 sungguhan** (papaparse) — sinopsis berisi koma/quote/markdown.
- Mapping: `judul→title`, **`judul_korea→titleKo`**, `judul_alternatif→altTitles` (**split ` | `** pipe, bukan koma — alt title sendiri boleh mengandung koma), `genre_terverifikasi`+`genre_1sumber→badges` kategori "Genre" (split `, `), `tema→badges` kategori "Tema" (split `, `), `tahun_asli→yearOriginal`, `tipe→type`, `status→statusRaw`, `author→authors` (split `, `), `skor_anilist→scoreAnilist`, `skor_mangaupdates→scoreMangaupdates`, `skor_mal` (selalu kosong → null), `sumber→daftar sumber metadata` (split `+`, bukan URL baca), `cover_file→path cover`, **`link_baca_1/2/3→readUrls[]`** (buang yang kosong, `source` diturunkan dari host), `sinopsis_id→synopsisId`, `sinopsis_en→synopsisEn`.
- **Tidak ada kolom `tahun_indo`** (berbeda dari metadata.csv lama) → `yearIndo` = null.
- **Status scraping**: `link_baca_1/2/3` saat ini **masih kosong di seluruh 118 baris** (proses scraping berjalan di sesi lain). Importer harus memperlakukan kolom kosong sebagai `readUrls: []` tanpa error, dan tetap bisa mengisinya lewat re-import berikutnya (mode Merge) begitu URL terisi.
- `cover_file` format `list{N}/{NN-slug}.{ext}` (ekstensi campur .jpg/.png) → dipakai matcher cover.

### 3.3 CSV lama — `metadata.csv` (19 kolom, opsional)
Format sebelumnya, **85 judul** (list1–3), tetap didukung untuk kompatibilitas. Beda dari library.csv: **ada** `tahun_indo`, **tidak ada** `judul_korea` & `link_baca_1/2/3`. Import dari format ini menghasilkan `readUrls: []` dan `titleKo: null`.

### 3.4 JSON (`metadata.json`)
Array objek 28-key, **85 judul**. Konsumsi langsung.
- **Coerce `year_original`**: 4 record berupa string → `Number()`.
- `score_mal` selalu null.
- **`source_url` → `readUrls[0]`** (1 URL per judul: 72 komiku + 13 bacakomik). Ini satu-satunya sumber yang saat ini benar-benar memuat URL baca, jadi berguna untuk melengkapi library.csv lewat Merge.
- Cover path **tidak ada di JSON** → cover dicocokkan terpisah (bulk cover import).
- `genres_consensus` + `genres_single_source` → badge "Genre"; `themes` → badge "Tema".

### 3.5 Status normalizer
Petakan keyword parenthetical pertama pada `statusRaw` → `workStatus`:
| pola sumber | workStatus |
|---|---|
| Complete, Completed, `Complete / Axed`, `Complete/Axed` | `complete` |
| Ongoing | `ongoing` |
| Hiatus, `Hiatus?` | `hiatus` |
| Dropped | `dropped` |
| Cancelled | `cancelled` |
| tidak dikenali / kosong | `unknown` |

Ekstraksi: ambil isi kurung pertama, lower-case, cocokkan substring prioritas (`cancel`→cancelled, `drop`→dropped, `hiatus`→hiatus, `complete`→complete, `ongoing`→ongoing).

## 4. Duplicate Detection

- **Kunci normalisasi**: `normalize(title)` = lower-case, trim, buang tanda baca/diakritik, samakan whitespace. Bandingkan juga terhadap `titleKo` & `altTitles` ternormalisasi.
- Saat import, tiap kandidat dicek terhadap library existing + terhadap batch itu sendiri.
- Klasifikasi preview: **detected** (total baris), **valid** (siap import), **duplicates** (cocok existing), **needs review** (data cacat / ambigu, mis. tanpa judul).
- Aksi per duplikat / massal: **Skip** (abaikan), **Replace** (timpa record lama), **Merge** (gabung: union altTitles/**readUrls**/badges/collections, isi field kosong, pertahankan tier/favorit/status milik pengguna).
- **Merge penting untuk kasus link**: karena `link_baca_*` di library.csv masih kosong, re-import dari `metadata.json`/TXT dengan mode **Merge** akan mengisi `readUrls` tanpa menimpa tier/favorit/badge yang sudah kamu set. Link digabung sebagai union berdasarkan URL (dedup URL identik).

## 5. Cover Matcher (Bulk / ZIP)

- Input: banyak file gambar atau satu ZIP (dibongkar via jszip).
- Untuk tiap file: `slug(namaFileTanpaEkstensi)` → cocokkan ke `slug(title)`/`slug(titleKo)`/`slug(altTitles)` judul. Toleran prefix indeks `NN-` (buang angka depan). Fuzzy (rasio kemiripan) untuk near-match; ambang tinggi agar aman.
- Ekstensi campur (.jpg/.png/.webp) ditangani via `file.type`.
- Simpan Blob ke store `covers`, set `title.coverId`. Tampilkan hasil: matched / unmatched (untuk assign manual).
- **Catatan dataset**: `covers/` berisi **118 cover** (list1=30, list2=30, list3=25, list4=33). Semua sudah bermetadata di `library.csv`; kalau import dari `metadata.csv`/JSON lama (85 judul), 33 cover `list4` akan jatuh ke **unmatched** — normal, bukan bug.

## 6. Filter Semantics

State `filterStore`:
```ts
interface FilterState {
  search: string;
  readingStatus: Set<ReadingStatus>;       // include
  tiers: Set<Tier>;                         // include
  favoriteOnly: boolean;
  workStatus: Set<WorkStatus>;
  badgeInclude: Set<string>;                // badge ids
  badgeExclude: Set<string>;
  badgeMatch: 'ALL' | 'ANY';
  chapterMin: number | null;                // rentang jumlah chapter (inklusif)
  chapterMax: number | null;
  collectionId: string | null;
  sort: 'title' | 'recent' | 'tier' | 'year' | 'chapters' | 'chapters-asc';
}
```
Evaluasi:
1. Ambil kandidat via index Dexie sesuai filter murah (status/tier/favorite).
2. **Rentang chapter**: bandingkan `chapterCount(t) = totalChapters ?? indoChapters` — inklusif di kedua ujung; judul tanpa data chapter tidak memenuhi rentang apa pun. Preset UI: `< 100`, `100–199`, `200–299`, `300+`, plus input min/max manual. Seluruh rentang dihitung sebagai **satu** filter aktif di `activeCount()`.
3. Untuk badge: dari `titleBadges` bangun `titleId → Set<badgeId>`.
   - **Match ALL**: `badgeInclude ⊆ titleBadges[t]`.
   - **Match ANY**: irisan `badgeInclude ∩ titleBadges[t]` tak kosong.
   - **Exclude**: `badgeExclude ∩ titleBadges[t]` harus kosong.
4. Terapkan search (judul + titleKo + altTitles), lalu sort. `chapters` = terbanyak dulu, `chapters-asc` = tersedikit dulu; tanpa data chapter selalu di akhir. Tampilkan count live untuk "Show N titles".
- Klik badge di kartu → set `badgeInclude = {badgeId}`, `badgeMatch='ANY'`, navigate ke Library.

## 7. Backup / Restore

- **Export penuh (ZIP)**: `library.json` (semua tabel kecuali blob) + folder `covers/<coverId>.<ext>` (Blob) + `manifest.json` (schemaVersion, count, tanggal). Portable lintas perangkat.
- **Export CSV**: subset judul dengan kolom mengikuti `library.csv` (25 kolom, termasuk `judul_korea`, `link_baca_1/2/3` & 3 kolom hitungan chapter) untuk interop dua arah.
- **Restore**: baca ZIP, validasi schemaVersion, tulis ulang semua store dalam transaksi (mode replace atau merge). Cover Blob dimuat kembali ke store `covers`.

## 8. State / Store Contract (Zustand)

- **`libraryStore`**: daftar judul (live query Dexie via `dexie-react-hooks` `useLiveQuery`), aksi CRUD judul, toggle read/favorite, set tier, bulk edit.
- **`filterStore`**: state filter di §6 + selector hasil terfilter.
- **`badgeStore`**: badge & kategori, CRUD, merge, usage count (dari `titleBadges`).
- **`uiStore`**: mode grid/compact, modal/bottom-sheet aktif, seleksi multi (bulk), toast queue.

Data reaktif diutamakan lewat `useLiveQuery` agar UI selalu sinkron dengan IndexedDB; Zustand memegang state UI/ephemeral & aksi.

## 9. PWA

- `vite-plugin-pwa` (registerType autoUpdate): precache app shell + aset statis.
- `manifest`: nama, ikon (maskable), `display: standalone`, theme color = background gelap dari [design.md](design.md).
- Data sudah lokal (IndexedDB) → offline penuh tanpa strategi cache jaringan khusus.

## 10. Verifikasi Teknis

- Unit test parser: **`library.csv` → 118 judul** (25 kolom, `judul_korea` terisi, `link_baca_*` kosong → `readUrls: []`); `metadata.csv` → 85; `metadata.json` → 85 dengan `readUrls[0]` dari `source_url`; TXT → 85. Cek judul Unicode, raw terpotong, status ganda, coercion tahun, split ` | ` pada alt title.
- Test dedup: import ulang → semua terdeteksi duplikat; test **Merge mengisi `readUrls` dari JSON/TXT ke record hasil library.csv** tanpa menimpa tier/favorit/badge.
- Test cover matcher: folder `covers/list1..4` → **118 ter-link** saat sumber `library.csv` (dan 33 `list4` jadi unmatched bila sumber metadata lama).
- Test backup→wipe→restore identik (termasuk `readUrls` & `titleKo`).
- `tsc --noEmit` & `npm run build` bersih; Lighthouse PWA pass.

**Catatan status data (29 Agu 2026)**: kolom `link_baca_1/2/3` di `library.csv` masih **kosong di seluruh 118 baris** karena scraping URL baca masih berjalan di sesi lain. Importer & UI harus menangani `readUrls: []` dengan baik (tombol "Read ↗" disembunyikan/disabled) dan siap terisi lewat re-import Merge.
