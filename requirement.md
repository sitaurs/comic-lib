# Requirement — Manhwa Library

Dokumen kebutuhan untuk **aplikasi library manhwa/manga pribadi** (booklist). Aplikasi bersifat **local-first**: tanpa login, tanpa server, semua data tersimpan di browser (IndexedDB), bisa dipakai offline, dan installable sebagai PWA.

Terkait: [design.md](design.md) (UI/UX), [spec.md](spec.md) (teknis), [plan.md](plan.md) (roadmap).

## 1. Ringkasan & Tujuan

Sebuah "digital bookshelf gallery" pribadi untuk mengoleksi, menilai, dan menemukan kembali manhwa/manga yang pernah/ingin dibaca. Cover adalah elemen visual utama. Pengguna menandai status baca, memberi *tier* subjektif (seberapa seru), menandai favorit, memasang *badge* kustom, mengelompokkan ke *collection*, dan memfilter koleksi dengan cepat.

Prinsip utama:
- **Privat & local-first** — data tidak pernah keluar dari perangkat kecuali pengguna mengekspor sendiri.
- **Cover sebagai hero** — UI tenang, cover menonjol.
- **Cepat & offline** — sanggup menangani 500+ judul + cover tanpa lag.

## 2. Aktor & Cakupan

Aktor tunggal: **pemilik** (single-user, tanpa autentikasi). Tidak ada peran lain, tidak ada sharing/kolaborasi online. Semua fitur tersedia penuh bagi pemilik di perangkatnya.

## 3. Kebutuhan Fungsional (FR)

Setiap kebutuhan punya ID `FR-NN`, deskripsi, dan acceptance criteria (AC).

### FR-01 — Library Grid
Menampilkan seluruh judul sebagai grid cover.
- AC: Ada pencarian (judul + judul Korea + alt title), sort (judul, terbaru ditambah, tier, tahun), dan dua mode tampilan **Grid** (cover besar) & **Compact** (padat). Tiap kartu menampilkan cover, tier chip, dan dot status baca.

### FR-02 — Reading Status (Pernah Baca / Belum Baca)
- AC: Status dapat diubah langsung dari kartu (Quick Edit) maupun halaman detail. Library dapat difilter berdasarkan status. Default judul baru = `Belum Baca`.

### FR-03 — Tier (SS/S/A/B/C/D/Unrated)
Penilaian **subjektif** ("seru"), bukan skor objektif.
- AC: Tier dapat di-set dari kartu & detail. Default = `Unrated`. Warna tier mengikuti [design.md](design.md). Bisa jadi kriteria filter & sort.

### FR-04 — Favorites
- AC: Toggle ♥ dari kartu & detail. Ada filter "Favorites Only".

### FR-05 — Custom Badges
Label bebas buatan pengguna (mis. "MC OP", "MC Smart", "Plot Bagus", "Action Gokil").
- AC: Badge dapat dipasang/dilepas ke judul (many-to-many). Satu judul bisa banyak badge.

### FR-06 — Badge Manager
Halaman kelola badge.
- AC: Buat/rename/hapus badge; buat kategori; pindah badge antar kategori; tampilkan **usage count** per badge; **merge** badge duplikat (gabungkan keanggotaan lalu hapus sumber). Menghapus badge melepasnya dari semua judul.

### FR-07 — Quick Badge Selector
- AC: Dari kartu/detail, buka selektor badge yang bisa dicari (searchable); tap untuk toggle; bisa buat badge baru langsung dari selektor.

### FR-08 — Custom Badge Categories
- AC: Kategori dapat dibuat pengguna (mis. MC/Cerita/Action/Comedy). Kategori default "Genre" & "Tema" dibuat otomatis. Badge selalu berada dalam satu kategori.

### FR-09 — Advanced Filter (Include / Exclude)
- AC: Filter berdasarkan badge, tier, status baca, favorit dengan set **Include** dan **Exclude** yang independen. Menampilkan jumlah hasil live ("Show N titles"). Tombol Clear.

### FR-10 — Match ALL / ANY (badge)
- AC: Untuk filter badge, pengguna memilih **Match ALL** (judul harus punya semua badge terpilih) atau **Match ANY** (cukup salah satu).

### FR-11 — Klik Badge → Filter
- AC: Mengklik badge (di kartu/detail) langsung memfilter library ke judul dengan badge tersebut.

### FR-12 — Tier View
- AC: Tampilan tier-list otomatis: baris SS → S → A → B → C → D → Unrated, tiap baris berisi cover judul pada tier itu, dengan jumlah per baris.

### FR-13 — Manual Add
- AC: Form tambah judul: cover (upload), judul, judul Korea (opsional), **satu atau beberapa URL baca**, status baca, tier, favorit, badge, work status, dan deskripsi opsional. Judul tersimpan ke library.

### FR-14 — Bulk Import (TXT / CSV / JSON)
- AC: Impor dari file TXT (format list asli pengguna), CSV, dan JSON. Parser menangani semua format dan memetakan ke skema judul. Format CSV utama = **`library.csv` (25 kolom, 118 judul)** termasuk `judul_korea`, `link_baca_1/2/3` & `jumlah_chapter`/`chapter_indo`/`chapter_sumber`; format lama `metadata.csv` (19 kolom, 85 judul) dan `metadata.json` tetap didukung.

### FR-15 — Import Preview
- AC: Sebelum commit, tampilkan ringkasan: jumlah **detected / valid / duplicates / needs review**, dan daftar yang bisa ditinjau.

### FR-16 — Duplicate Detection
- AC: Deteksi duplikat berdasarkan judul ter-normalisasi + alt title. Tawarkan aksi **Skip / Replace / Merge** per duplikat (atau massal).

### FR-17 — Bulk Cover Import
- AC: Unggah banyak gambar atau ZIP; cocokkan nama file ke judul via slug (mis. `nano-machine.jpg` → "Nano Machine"). Tangani ekstensi campur (.jpg/.png). Tampilkan hasil match & yang tak cocok. Dataset punya **118 cover** (`covers/list1..4`).

### FR-18 — Bulk Edit
- AC: Pilih banyak judul (multi-select) lalu terapkan sekaligus: tandai read/unread, tambah badge, set tier, tambahkan ke collection.

### FR-19 — Collections
- AC: Kelompok judul many-to-many, terpisah dari badge. Buat/rename/hapus collection; tambah/keluarkan judul; satu judul bisa di banyak collection.

### FR-20 — Detail Page
- AC: Halaman detail: cover besar, tier/♥/status baca/work status, tombol Open Reader ↗ & Edit, dan tab: Description, Collections, Badges, Metadata. (Status baca biner — tanpa progress chapter, tab Reading Progress, atau History.)

### FR-21 — Quick Edit (••• popover)
- AC: Popover dari kartu untuk edit cepat status baca, tier, favorit, dan badge tanpa membuka detail.

### FR-22 — Read Link (bisa beberapa sumber)
- AC: Tiap judul dapat menyimpan **satu atau beberapa** URL baca (`link_baca_1/2/3` dari CSV, atau ditambah manual). Tiap link punya tombol "Read ↗" dengan label sumber (komiku.org / bacakomik.my / lainnya). Judul tanpa link menyembunyikan/men-disable tombol tanpa error. Link dapat ditambah/hapus dari Edit & terisi otomatis lewat import Merge.

### FR-23 — Home
- AC: Statistik ringkas (Total, Favorites, jumlah SS, Belum Baca) + baris cover **Recently Added** + entri Random Pick. (Tanpa "Continue Reading" — tidak melacak progress chapter.)

### FR-24 — Random Pick
- AC: Pilih judul acak dengan lingkup: semua / belum baca / tier SS–S / dari collection tertentu.

### FR-25 — Backup & Restore
- AC: Export **JSON** (seluruh data) dan **CSV** (subset), plus backup/restore penuh termasuk cover. Restore memulihkan seluruh state.

### FR-26 — Local-First
- AC: Tanpa login, tanpa server DB. Data di penyimpanan lokal (IndexedDB), berfungsi offline, privat.

### FR-27 — PWA / Installable
- AC: Aplikasi installable (manifest + service worker), app shell ter-cache, berjalan offline.

## 4. Prioritas Versi Pertama (MVP)

Wajib di versi pertama: **FR-01 Library, FR-13 Manual Add, FR-14 Bulk Import, FR-03 Tier, FR-02 Read/Unread, FR-04 Favorite, FR-06 Badge Manager, FR-09/10/11 Badge Filter, FR-19 Collections, FR-18 Bulk Edit, FR-17 Cover Import, FR-25 Backup/Restore.**

Menyusul: FR-12 Tier View, FR-23 Home, FR-24 Random Pick, tab lengkap FR-20, penyempurnaan FR-27 PWA.

## 5. Kebutuhan Non-Fungsional (NFR)

- **NFR-01 Privasi/Local-first**: tidak ada panggilan jaringan yang mengirim data pengguna; tidak ada telemetri.
- **NFR-02 Offline**: seluruh fungsi inti jalan tanpa internet setelah load pertama.
- **NFR-03 Performa**: grid tetap responsif pada 500+ judul + cover (target interaksi < 100ms; gunakan virtualisasi bila perlu; cover via object URL / lazy-load).
- **NFR-04 Persistensi**: data aman di IndexedDB; cover disimpan sebagai Blob; pertimbangkan `navigator.storage.persist()`.
- **NFR-05 Portabilitas**: backup ZIP (JSON + cover) dapat direstore penuh di perangkat lain.
- **NFR-06 Aksesibilitas**: kontras memadai pada tema gelap, target sentuh memadai di mobile, dukungan keyboard untuk aksi utama.
- **NFR-07 Responsif**: layout desktop & mobile (bottom nav, bottom sheet, action bar) sesuai [design.md](design.md).
- **NFR-08 Ketahanan import**: parser toleran terhadap data tidak rapi (judul Unicode, raw terpotong, status non-standar) tanpa crash.

## 6. Data Awal (Seed)

Aplikasi **mulai kosong**. Dataset di `data/` + `covers/` dipakai untuk **menguji importer**, bukan di-seed otomatis. Saat import, genre & tema dari metadata otomatis menjadi badge berkategori (kategori "Genre" & "Tema"); tier awal `Unrated`, favorit `false`, status `Belum Baca`.

Sumber data proyek saat ini:
- **`data/library.csv`** — format utama, **118 judul** (list1–4), 25 kolom, ada `judul_korea`, `link_baca_1/2/3` & 3 kolom hitungan chapter.
- `data/metadata.csv` (85 judul, 19 kolom) & `data/metadata.json` (85 judul, punya `source_url`) — format lama, tetap didukung.
- `data/list-manhwa-asli.txt` — 85 entri, 1 URL baca per entri.
- `covers/list1..4` — **118 cover**.

**Status scraping (29 Agu 2026)**: kolom `link_baca_1/2/3` di `library.csv` **masih kosong** karena URL baca sedang di-scrape di proses lain. Sampai selesai, URL baca dapat dilengkapi lewat import Merge dari `metadata.json`/TXT (yang memuat 72 komiku + 13 bacakomik).
