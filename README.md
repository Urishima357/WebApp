# Garasi Hobby

Sistem informasi operasional bengkel dan showroom Garasi Hobby, direncanakan sebagai web responsif/PWA dengan satu backend dan database terpusat.

## Status

Repositori saat ini berisi dokumen requirement, referensi desain, dan struktur folder awal. Framework belum diinstal dan aplikasi belum dapat dijalankan. Belum ada dependency, migration, model, endpoint, maupun konfigurasi deployment.

Stack yang direncanakan: **Laravel API**, **React + TypeScript + Vite**, dan **MySQL Community dengan engine InnoDB**. Backend menggunakan pembagian modul dalam satu aplikasi (modular monolith). Bahasa antarmuka adalah Bahasa Indonesia.

## Struktur folder

| Folder | Kegunaan |
|---|---|
| `apps/api/app/Modules/` | Modul backend: Identity, Business, Customers, Vehicles, Inventory, Purchasing, Workshop, Showroom, Transactions, Payments, Media, Reporting, dan Audit. |
| `apps/api/app/Support/` | Utilitas backend bersama yang tidak dimiliki satu modul bisnis. |
| `apps/api/database/` | Migration, factory, dan seeder saat implementasi dimulai. |
| `apps/api/routes/` | Definisi route backend. |
| `apps/api/tests/` | Pengujian unit dan fitur/integrasi backend. |
| `apps/web/public/` | Aset statis publik frontend; bukan tempat foto operasional privat. |
| `apps/web/src/app/` | Inisialisasi aplikasi, provider, layout, dan routing frontend. |
| `apps/web/src/features/` | Halaman dan logika frontend berdasarkan fitur. |
| `apps/web/src/components/` | Komponen UI bersama. |
| `apps/web/src/lib/` | HTTP client dan utilitas frontend bersama. |
| `apps/web/src/styles/` | Style global dan token desain. |
| `contracts/` | Kontrak API/OpenAPI dan definisi pertukaran data. |
| `docs/architecture/` | Arsitektur, batas modul, dan aliran proses. |
| `docs/database/` | Desain skema MySQL, data dictionary, constraint, dan index. |
| `docs/decisions/` | Keputusan teknis, asumsi, dan keputusan yang masih terbuka. |
| `docs/testing/` | Strategi pengujian, test case, dan pemetaan requirement/UAT. |
| `infra/` | Konfigurasi infrastruktur saat deployment direncanakan. |
| `scripts/` | Skrip setup dan pemeliharaan saat diperlukan. |
| `designs/` | Referensi desain dan catatan konversi ERD yang sudah tersedia. |

Direktori kosong berisi `.gitkeep` agar tersimpan di Git. Subfolder internal modul backend dan fitur frontend ditambahkan ketika implementasinya dimulai.

## Acuan proyek

- [PRD v1.2](<Product Requirements Document (PRD) v1.2.md>) menjadi baseline kebutuhan produk.
- [ERD dan LRS](<ERD Garasi Hobby Priok.drawio>) menjadi referensi model servis dan penjualan; [catatan konversi](designs/erd/CATATAN_KONVERSI.md) menjelaskan bagian yang perlu diselaraskan dengan PRD sebelum menjadi skema aplikasi.
- [Desain Stitch](designs/stitch/README.md) dan [spesifikasi motion](designs/stitch/MOTION.md) menjadi acuan tampilan.

Target anggaran adalah Rp0. Struktur awal ini tidak memasang layanan atau dependency. Hosting, storage produksi, dan payment gateway belum ditetapkan. Metode pembayaran selisih pada transaksi koreksi tetap menunggu keputusan owner.
