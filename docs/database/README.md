# Database Garasi Hobby ? sesuai ERD draw.io

Skema aktif mengikuti **ERD/LRS draw.io**, sesuai koreksi pengguna. Dua database terpisah:

- **garasi_hobby_servis: 7 tabel** ? pelanggan, kendaraan, nota_servis, mekanik, pegawai, detail_servis, pembayaran.
- **garasi_hobby_showroom: 5 tabel** ? pembeli, penjualan, motor, pegawai, pembayaran.

Tidak ada tabel tambahan role, audit, stok, migration journal, atau lainnya. Nama kolom, PK/FK, dan UK mengikuti LRS. PEGAWAI dan PEMBAYARAN tetap terpisah di kedua database.

## Berkas aktif

- [SQL dan cara menerapkan](../../apps/api/database/erd/README.md).
- [Skema dan relasi](SCHEMA.md).
- [Data dictionary dari LRS](DATA_DICTIONARY.md).
- [Hasil pemeriksaan](verification-results.json).
- [Keamanan lokal](SECURITY.md).
- [Audit keamanan mendalam dan temuan terbuka](SECURITY_AUDIT.md).

Server MySQL tetap 127.0.0.1:3307 dengan TLS. Koneksi backend privat mengarah ke garasi_hobby_servis dan garasi_hobby_showroom. phpMyAdmin hanya menampilkan kedua database ini memakai akun hanya-baca.

## Skema sebelumnya

Database 43 tabel dibuat karena perluasan PRD yang keliru. Dokumen, SQL, dan script sebelumnya dipertahankan di [arsip](archive/prd-expansion/ARCHIVED.md), bukan sumber schema aktif. Database lama garasi_hobby beserta backup privat tidak dihapus; akun phpMyAdmin tidak lagi diberi akses ke sana. Tidak ada data operasional non-seed ditemukan di skema lama saat koreksi dilakukan.
