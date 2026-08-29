# Design System — Manhwa Library

Dokumen ini adalah **sumber kebenaran UI/UX**, diturunkan langsung dari gambar mockup design-system yang diberikan pengguna. Filosofi: **Editorial UI + Bento Grid + Dark Minimalism + sedikit Glassmorphism**. Cover adalah pahlawan visual; UI tenang dan tidak bersaing dengan artwork. Aplikasi adalah "digital bookshelf gallery".

Terkait: [requirement.md](requirement.md), [spec.md](spec.md).

## 1. Prinsip Desain

- **Cover-first**: cover selalu jadi elemen paling menonjol; metadata dibuat quiet.
- **Dark minimalism**: latar charcoal (bukan hitam murni), mayoritas kartu flat.
- **Glass hemat**: glassmorphism hanya untuk elemen mengambang — filter bar, search, modal, bottom sheet.
- **Editorial typography**: judul besar & tegas, metadata kecil & tenang.
- **Interaksi halus**: hover cover = zoom lembut + gradient overlay; transisi ringan.

## 2. Token Warna

### Permukaan / Netral
| Token | Hex | Pakai |
|---|---|---|
| `bg` (Background) | `#111214` | latar utama aplikasi |
| `bg-secondary` | `#15171A` | area sekunder |
| `surface` | `#1A1C20` | kartu, panel |
| `elevated` | `#202329` | elemen terangkat, popover, hover |
| `border` | `rgba(255,255,255,0.06)` | garis pemisah halus |

### Teks
| Token | Hex |
|---|---|
| `text-primary` | `#F5F5F4` |
| `text-secondary` | `#A1A1AA` |
| `text-muted` | `#71717A` |

### Warna Tier
| Tier | Hex | Nuansa |
|---|---|---|
| SS | `#F5C166` | emas |
| S | `#BB6CFF` | ungu |
| A | `#4E6AFF` | biru |
| B | `#34D399` | hijau |
| C | `#FFB04A` | oranye |
| D | `#EF4444` | merah |
| Unrated | `#52525B` | abu |

### Aksen
- **Primary / brand**: emas–amber (dipakai untuk Primary Button, highlight aktif) selaras dengan tier SS `#F5C166`.

## 3. Tipografi

- **Editorial**: judul halaman & judul cover berukuran besar, tebal, tracking rapat.
- **Metadata**: kecil, `text-secondary`/`text-muted`, tenang.
- Hirarki: Page Title > Section Header > Card Title > Metadata/Label.
- Gunakan satu keluarga sans modern (mis. Inter) + opsional serif/display untuk aksen editorial pada judul besar.

## 4. Komponen

### Buttons
- **Primary**: isi emas/amber, teks gelap — aksi utama (Add Title, Show N titles).
- **Secondary**: `surface`/`elevated` dengan border halus, teks terang.
- **Ghost**: transparan, teks `text-secondary`, hover `elevated`.

### Chips & Indikator
- **Tier chip**: bulat/pill kecil berwarna sesuai tier, ditempel di kartu & detail.
- **Heart (♥)**: toggle favorit; aktif = amber/merah, nonaktif = `text-muted`.
- **Pill "Pernah Baca"**: pill status baca (mis. hijau untuk pernah baca).
- **Badge chip**: pill `elevated` dengan teks; varian editable punya tombol `x` untuk lepas.
- **Filter chip**: pill toggle di panel filter (state aktif = amber outline/isi).
- **Read link chip/button**: satu tombol sekunder per sumber baca (`Read ↗ Komiku`), ditumpuk bila lebih dari satu. **Empty state**: kalau judul belum punya link (mis. hasil import saat scraping belum selesai), tombol disembunyikan dan diganti teks quiet "Belum ada link baca" di detail.

### Status Indicators (dot)
Dot warna kecil di kartu untuk status baca biner: **Pernah Baca** (hijau) & **Belum Baca** (abu). (Model status memang biner — tanpa Plan to Read/Dropped/On Hold.)

### Surfaces mengambang (glass)
- **Modal**: latar `surface` semi-transparan + blur, border halus, shadow lembut.
- **Bottom sheet** (mobile): sama, muncul dari bawah untuk Filter & Quick Edit.
- **Filter/Search bar**: glass tipis saat mengambang di atas grid.

### Toast
- Muncul sementara, `elevated` + border, mis. "Saved changes to Nano Machine".

## 5. Spesifikasi Layar

### 1 — Home
**4 stat tile** (Bento): Total, Favorites, jumlah SS, Belum Baca. Di bawahnya **baris cover Recently Added** (scroll horizontal) dan entri **Random Pick** 🎲. (Tanpa "Continue Reading" — status baca biner, tidak melacak progress chapter.)

### 2 — Library
Toolbar: **Search · Filter · Sort · Grid/Compact · Add Title**. Grid cover padat; tiap kartu = cover + **tier chip** + **dot status**. Mode Compact lebih rapat. Hover: zoom + gradient overlay + ••• Quick Edit.

### 3 — Advanced Filter
Panel/section: **Reading**, **Tier**, **Favorite**, **Badges** (dengan **Match ALL/ANY**), **Exclude**, tombol **Clear**, dan tombol utama **Show N titles** (count live).

### 4 — Manga Detail
Cover besar di kiri; kanan: judul (+ judul Korea kecil di bawahnya), tier / ♥ / ✓ status baca / work status (ONGOING/COMPLETE); tombol **Read ↗ per sumber** (mis. `Read ↗ Komiku`, `Read ↗ BacaKomik`; disembunyikan bila judul belum punya link) & **Edit**. Tab: **Description · Collections · Badges · Metadata**. (Tanpa progress bar chapter & tab Reading Progress/History — status baca biner.)

### 5 — Tier View
Baris per tier **SS → S → A → B → C → D → Unrated**, tiap baris berisi cover + jumlah judul (mis. SS 36, S 58, A 97, …).

### 6 — Badge Manager
Kategori (mis. MC / Cerita / Action) berisi badge + **usage count**; menu ••• per badge: **Rename / Move / Merge / Delete**. Bisa buat kategori & badge baru.

### 7 — Quick Edit (popover)
Popover dari ••• kartu: ubah status baca, tier, favorit, badge dengan cepat tanpa buka detail.

## 6. Pola Mobile

- **Bottom nav**: Home · Library · Collections · Badges · Settings.
- **Bottom sheet**: Filter & Quick Edit muncul dari bawah.
- **Action Bar** (bulk edit): bar bawah "N Selected" dengan aksi massal (mark read, add badge, set tier, add to collection).
- **Cover card**: state Default & Pressed (feedback tekan).
- **Random Pick**: tombol dadu 🎲 di mobile.

## 7. Navigasi (desktop)

**Home · Library · Collections · Badges · Settings** — konsisten dengan bottom nav mobile.

## 8. Motion & Interaksi

- Hover cover: `scale ~1.03` + gradient bawah untuk keterbacaan judul.
- Transisi modal/sheet: fade + slide singkat (150–200ms), easing halus.
- Toggle (favorit/status/tier): perubahan instan + toast konfirmasi.
- Hormati `prefers-reduced-motion`: matikan zoom/slide bila diminta.

## 9. Pemetaan Token → Tailwind

Extend `tailwind.config.theme.colors` dengan token di §2 (mis. `bg`, `surface`, `elevated`, `border`, `text.primary/secondary/muted`, `tier.ss…unrated`, `brand`). Semua komponen memakai nama token ini, bukan hex mentah, agar konsisten dengan mockup.
