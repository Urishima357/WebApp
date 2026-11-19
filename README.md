# Garasi Hobby

Sistem informasi operasional bengkel dan showroom Garasi Hobby, direncanakan sebagai web responsif/PWA dengan satu backend dan database terpusat.

## Status

Frontend responsif **React + TypeScript + Vite** sudah tersedia di [`apps/web`](apps/web/README.md), dengan [revisi visual kedua 9 November 2026](docs/testing/UI-REVISION-02-2026-11-09.md) mengikuti komposisi layar Stitch: panel ringkasan, kartu servis mobile, aset raster tanpa SVG, motion native foto/halaman/dialog. Modul operasional dapat dicoba memakai akun dan data demo lokal. Pilot bengkel terintegrasi memakai Laravel dan MySQL lokal. Lihat [cara menjalankan pilot](apps/api/README.md).

Stack: **React + TypeScript + Vite** untuk frontend; backend pilot **Laravel API** dan **MySQL Community dengan engine InnoDB**. Backend dirancang modular monolith. Bahasa antarmuka Bahasa Indonesia.

```powershell
cd apps/web
npm ci
npm run dev
```

Frontend menyediakan login role demo, dashboard, WO, showroom, stok, pelanggan, supplier, penerimaan, POS, pembayaran simulasi, nota A4, kontrol finansial, laporan, audit, dan pengaturan. `npm test` menjalankan pemeriksaan aturan demo; `npm run build` memeriksa TypeScript dan membuat build produksi. Lihat [cakupan dan hasil pemeriksaan](docs/testing/FRONTEND.md).

**Gunakan data uji.** Demo menyimpan data di browser. Pilot bengkel menyimpan data di MySQL, memakai akun dan otorisasi server, serta mendukung pembayaran manual. QRIS/e-wallet, deployment, dan UAT stakeholder masih terbuka.

## Struktur folder

| Folder | Kegunaan |
|---|---|
| `apps/api/app/Modules/` | Modul backend: Identity, Business, Customers, Vehicles, Inventory, Purchasing, Workshop, Showroom, Transactions, Payments, Media, Reporting, dan Audit. |
| `apps/api/app/Support/` | Utilitas backend bersama yang tidak dimiliki satu modul bisnis. |
| `apps/api/database/` | Migrasi pilot dan SQL ERD/LRS. |
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

Direktori modul yang belum terimplementasi berisi `.gitkeep`. Frontend menyediakan pilot bengkel serta modul demo lain dengan aset lokal dan pemeriksaan domain.

## Acuan proyek

- [PRD v1.2](<Product Requirements Document (PRD) v1.2.md>) menjadi baseline kebutuhan produk.
- [Usulan keputusan rilis 19 November](docs/decisions/2026-11-19-skema-dan-ruang-lingkup-rilis.md) mencatat pilihan skema aplikasi dan cakupan tahap pertama yang menunggu persetujuan. [BPMN servis TO-BE](designs/bpmn/README.md) memetakan alur servis dan skenario review terhadap PRD.
- [ERD dan LRS](<ERD Garasi Hobby Priok.drawio>) menjadi referensi model servis dan penjualan; [catatan konversi](designs/erd/CATATAN_KONVERSI.md) menjelaskan bagian yang perlu diselaraskan dengan PRD sebelum menjadi skema aplikasi.
- [Desain Stitch](designs/stitch/README.md) dan [spesifikasi motion](designs/stitch/MOTION.md) menjadi acuan tampilan.

Target anggaran Rp0. Frontend tidak memasang layanan berbayar; dependency runtime hanya React dan React DOM. Hosting, storage produksi, dan payment gateway belum ditetapkan. Metode pembayaran selisih pada transaksi koreksi tetap menunggu keputusan owner; frontend hanya mendemonstrasikan alur tanpa memindahkan dana.
