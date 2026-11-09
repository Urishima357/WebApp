# Desain Database Garasi Hobby

Tanggal: 8 November 2026. Status: **database development lokal sudah dibuat; model bisnis yang masih terbuka tetap menunggu review**.

Runtime lokal: MySQL Community 8.4.13 LTS dengan InnoDB, database `garasi_hobby` pada `127.0.0.1:3307`, TLS wajib. Bahasa kode/tabel menggunakan bahasa Inggris; label pengguna tetap Bahasa Indonesia. Frontend dan ERD/LRS tidak diubah oleh pekerjaan database.

## Dokumen

1. [Skema dan aturan integritas](SCHEMA.md): pemetaan PRD/ERD, relasi, status, transaksi atomik, index, urutan migration, serta skenario pengujian.
2. [Data dictionary](DATA_DICTIONARY.md): kolom, tipe data, nullability, nilai awal, referensi, dan constraint usulan.
3. [Setup dan batas keamanan](../../infra/mysql/README.md): instalasi portable, akun, kredensial privat, start/stop, backup, dan restore.
4. [Hasil verifikasi aktual](verification-results.json): pengujian MySQL dalam schema terisolasi, termasuk hak akses, constraint, concurrency, serta backup/restore.
5. [Ringkasan keamanan dan batas jaminan](SECURITY.md): kontrol yang dibuktikan dan pekerjaan sebelum produksi.

Implementasi fisik: 42 tabel bisnis/pendukung ditambah `schema_versions` untuk journal tiga migration SQL. `payment_allocations` belum dibuat dan trigger menolak KOR sampai keputusan bisnis ditutup. Tidak ada password owner aplikasi bawaan atau data pelanggan uji dalam database utama. SQL fisik berada di `apps/api/database/sql/`; backend Laravel belum diinstal.

Acuan: [PRD v1.2](<../../Product Requirements Document (PRD) v1.2.md>), [ERD/LRS](<../../ERD Garasi Hobby Priok.drawio>), dan [catatan konversi](../../designs/erd/CATATAN_KONVERSI.md). Ketentuan PRD menjadi baseline; keputusan tambahan di sini berstatus usulan teknis, bukan sign-off bisnis.

## Cakupan dan tahap berikutnya

Desain mencakup data pendukung P0: akses, konfigurasi, pelanggan/motor, inventaris, bengkel, showroom, transaksi, pembayaran, audit, dan migrasi. Beberapa tabel merupakan detail normalisasi atau pendukung integritas, bukan fitur baru. Tabel/framework queue dan cache dipilih saat Laravel dipasang.

Urutan implementasi tetap bertahap: fondasi akses/konfigurasi, pelanggan/motor, stok/penerimaan, bengkel, showroom, lalu transaksi/pembayaran beserta pengujian integrasi. Relasi silang yang belum dapat dibuat ditambahkan pada migration tahap kedua setelah tabel tujuannya ada.

Dokumen ini belum merupakan kontrak API final. Agent frontend dapat memakai nama konsep dan kode status pada skema sebagai bahan koordinasi; respons API tetap harus ditetapkan bersama backend dalam OpenAPI. Frontend tidak menerima akses langsung ke database.

## Keputusan yang belum ditutup

- Metode pembayaran selisih pada dokumen koreksi tetap menunggu keputusan Pak Arif. Struktur alokasi dana dirancang, tetapi aksi koreksi pembayaran tidak diaktifkan dahulu.
- Provider gateway, merchant account, biaya, dan mekanisme refund: OQ-01/02.
- Hosting/storage/backup beserta pemilik akun dan retensi foto: OQ-03/04.
- Volume uji aktual dan masa berlaku reservasi default: OQ-05/06. Tidak menetapkan durasi reservasi bisnis secara sepihak.
- Kebijakan negosiasi, delegasi, pembatalan jasa, pengadaan/rekondisi internal, serta garansi mengikuti baseline dan keputusan terbuka OQ-10 sampai OQ-17.
- Target biaya Rp0 merupakan batas pemilihan infrastruktur; tidak mengasumsikan gateway dan hosting produksi gratis tanpa batas.

ERD/LRS yang sudah dibuat dipertahankan sebagai referensi model awal. Desain fisik di dokumen ini menjelaskan penyesuaiannya sebelum migration dibuat.
