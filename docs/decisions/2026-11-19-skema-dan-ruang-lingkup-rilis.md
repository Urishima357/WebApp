# Usulan skema dan ruang lingkup rilis Garasi Hobby

- **Tanggal pengajuan** 19 November 2026
- **Status** Menunggu review Aya dan keputusan Pak Arif
- **Prioritas** P0 karena keputusan ini menentukan desain data, kontrak API, dan cakupan UAT.

## Keputusan yang diajukan

Pertahankan dua database 7 + 5 tabel sebagai acuan ERD/LRS yang sudah disepakati. Untuk memenuhi PRD v1.2, usulkan skema aplikasi terpusat yang dikembangkan melalui migrasi Laravel di database pengembangan terpisah. Ilyas dan Aya meninjau pemetaan kebutuhan ke tabel dan dampaknya sebelum migrasi digunakan di lingkungan bersama. Skema 43 tabel di arsip dapat dirujuk saat meninjau desain. [Skema aktif](../database/README.md) · [Pemetaan ERD dan PRD](../../designs/erd/CATATAN_KONVERSI.md)

| Pilihan | Dampak pada rilis |
|---|---|
| **A. Setujui perluasan skema aplikasi secara bertahap** | Tahap pertama berfokus pada alur bengkel terintegrasi. Skema dirancang untuk identitas motor bersama sejak awal. P0 lain, termasuk showroom, POS barang, QRIS/e-wallet, koreksi/refund, dan pelaporan, tetap menjadi bagian dari MVP penuh. |
| **B. Batasi rilis pada skema 7 + 5** | Cakupan data terbatas pada pencatatan servis/penjualan motor, detail servis dan pembayaran yang sesuai dengan LRS. Alur WO lengkap, stok/WAC, autentikasi dan hak akses, histori kepemilikan lintas domain, foto privat, kontrol transaksi, dan audit belum terpenuhi. Jadikan hasilnya demo dengan data uji dan mintakan persetujuan tertulis atas pengecualian atau penundaan P0 sebelum menyepakati bentuk serah terima. |

## Cakupan tahap pertama jika pilihan A disetujui

| Cakupan | Bukti penerimaan | PIC usulan |
|---|---|---|
| Login dan hak akses, pelanggan, identitas motor, master barang/jasa, mekanik, pemasok, lokasi default (AUTH, CRM, MST) | Staf berizin dapat membuat WO dari motor yang sudah ada. API menolak aksi dan tidak mengirim data finansial yang berada di luar hak staf. | Ilyas dan Syamil |
| Penerimaan barang dan ledger stok (INV, PUR-03–06) | Draft penerimaan tidak mengubah saldo. Finalisasi mencatat barang masuk dan menghitung biaya rata-rata. Jika dua staf mengonfirmasi pemakaian unit terakhir di waktu yang sama, hanya satu yang berhasil. | Ilyas |
| WO, inspeksi dan foto privat, estimasi, persetujuan, pemakaian dan pembatalan sebelum final (WKS-01–14, WKS-17) | WO bisa menunggu barang dan dilanjutkan setelah pemeriksaan ulang. Perubahan di atas ambang meminta persetujuan ulang. Pembatalan mencatat alasan dan merekonsiliasi barang yang sudah keluar. | Ilyas dan Syamil |
| Pelunasan tunai/transfer manual, nota A4/PDF dan serah terima (PAY-01, PAY-03, PAY-05, PAY-07, BR-WKS-04) | Satu pembayaran lunas terverifikasi menghasilkan satu transaksi final dan satu nomor nota. Pemakaian stok tidak dicatat ulang. Perangkat kedua melihat transaksi yang sama. | Ilyas dan Syamil |
| Uji alur bengkel di staging dan penetapan batas demo | Aya memandu uji bersama staf dengan data uji dan mencatat skenario lulus, kegagalan, dan P0 yang masih terbuka. | Aya, Ilyas dan Syamil |

## Jadwal, estimasi, dan risiko

- **Usulan untuk 30 November** adalah demo staging dengan alur yang sudah lulus uji internal dan daftar pekerjaan tersisa. Jika alur terintegrasi belum lulus, laporkan progres aktual dan tanggal target baru. Jadwal produksi mengikuti hasil UAT, kesiapan data awal, hosting, dan uji pemulihan backup.
- **Estimasi untuk memilih skema dan menyepakati kontrak awal** adalah satu hari kerja tim, dengan asumsi Aya, Ilyas, dan Syamil bisa meninjau bersama. Estimasi implementasi dan tanggal staging disusun Ilyas dan Syamil setelah ruang lingkup disepakati.
- **Risiko utama** adalah benturan antara LRS dan model data aplikasi, duplikasi transaksi saat operasi diulang, serta pilihan hosting dan penyimpanan foto yang belum ditetapkan. Gunakan migrasi terpisah, uji transaksi lintas perangkat, dan konfirmasi OQ-03 sebelum menyepakati jadwal staging. Pemilihan payment gateway (OQ-01) dapat berjalan paralel untuk MVP penuh.

## Persetujuan yang diminta

Aya meninjau cakupan, estimasi, dan dampak jadwal, lalu mengajukan pilihan **A** atau **B** kepada Pak Arif. Catat pilihan, batas demo atau serah terima 30 November, pengecualian P0 yang disetujui, dan tanggal keputusan di sini. Perbarui Gantt berdasarkan keputusan dan bukti progres aktual.

| Pihak | Keputusan | Tanggal |
|---|---|---|
| Aya | Menunggu review | |
| Pak Arif | Menunggu persetujuan | |

[PRD v1.2](<../../Product Requirements Document (PRD) v1.2.md>) · [BPMN servis TO-BE dan skenario review](../../designs/bpmn/README.md) · [Gantt chart](../../Template_Timeline_Proyek_PIC_Aya_Ilyas_Syamil.xlsx)
