# Konversi LRS ke ERD Notasi Chen

Tanggal: 8 November 2026.

File: `../../ERD Garasi Hobby Priok.drawio`.

## Sumber dan cakupan

- Halaman **ERD Servis** diturunkan dari **LRS Servis**: 7 entitas, 34 atribut non-FK, dan 6 relasi.
- Halaman **ERD Showroom** diturunkan dari **LRS Penjualan**: 5 entitas, 30 atribut non-FK, dan 5 relasi.
- Kedua halaman LRS dipertahankan byte demi byte. Tidak ada perubahan kolom, key, konektor, atau tata letak LRS.
- Semua bentuk, label, dan konektor ERD merupakan objek draw.io yang dapat diedit; bukan gambar tempelan.

## Notasi

Entitas memakai persegi panjang, atribut memakai oval, relasi memakai belah ketupat. Primary key digarisbawahi. Unique key dicatat sebagai catatan halaman, bukan garis bawah primary key. Foreign key direpresentasikan oleh hubungan antarentitas dan tidak diulang sebagai oval.

Label **1 / N** di dekat entitas menunjukkan kardinalitas maksimum pada sisi entitas tersebut. Garis tunggal berarti partisipasi opsional; garis ganda berarti partisipasi wajib. Contoh: seorang pelanggan boleh belum memiliki kendaraan (garis tunggal), sedangkan setiap kendaraan wajib terkait dengan seorang pelanggan (garis ganda).

Garis ganda dibentuk dari dua konektor paralel yang ujungnya terhubung ke objek entitas dan relasi. Saat memindahkan objek, kedua konektor dapat disesuaikan bersama agar jaraknya tetap rapi.

## Perbedaan yang perlu dibahas terhadap PRD v1.2

Konversi ini mengikuti LRS yang diberikan. Poin berikut tidak diubah dalam LRS maupun ERD:

| Area | Model LRS yang dipertahankan | Ketentuan PRD yang perlu direkonsiliasi sebelum menjadi skema aplikasi |
|---|---|---|
| Nomor polisi | `KENDARAAN.no_polisi` dan `MOTOR.no_polisi` ditandai UK. | CRM-03 menetapkan nomor polisi tidak unik; nomor rangka dan mesin unik jika terisi. |
| Identitas motor | `KENDARAAN` pada servis dan `MOTOR` pada showroom merupakan entitas terpisah. | DEC-08 meminta satu identitas motor sepanjang lifecycle showroom, kepemilikan pelanggan, dan servis. |
| Kepemilikan | Kendaraan mengacu langsung ke pelanggan; belum ada entitas histori kepemilikan. | Bagian 14 menetapkan histori `VehicleOwnership` dan maksimal satu kepemilikan aktif per motor. |
| Pembayaran | Nota/penjualan memiliki tepat satu pembayaran; relasi wajib 1:1 mengikuti konektor LRS. | Model aplikasi memiliki beberapa payment attempt untuk retry, termasuk status menunggu pembayaran dan penanganan webhook. Pembayaran berhasil tetap dibatasi sesuai aturan PRD. |
| WO dan estimasi | `NOTA_SERVIS` memuat nomor WO; WO serta versi estimasi belum dimodelkan terpisah. | WKS-01 sampai WKS-15 membedakan WO, estimasi/persetujuan, pemakaian aktual, dan transaksi final. |
| Kelengkapan domain | LRS berfokus pada nota servis dan penjualan motor. | Model database seluruh P0 juga mencakup stok/ledger, penerimaan barang, foto, pengguna/permission, diskon/approval, refund, audit, dan konfigurasi. |

Daftar tersebut adalah catatan review, bukan perubahan requirement atau pernyataan bahwa LRS telah menjadi skema database produksi yang lengkap. Metode pembayaran selisih pada transaksi koreksi tetap menunggu keputusan owner.

## Verifikasi

- XML dapat diparse; ID objek unik dalam setiap halaman dan seluruh referensi konektor valid.
- Atribut non-FK, primary key, unique key, label hubungan, kardinalitas maksimum, dan partisipasi ditelusuri ke LRS.
- Hash SHA-256 blok halaman LRS sebelum dan sesudah pengeditan sama:
  - LRS Servis: `bfcbd4b7d888c2a290cfc53c8fc9aefee51053015a94d68b2acc04f2006d6743`.
  - LRS Penjualan: `3f404d176547b473571d27a2668ecb5fa2955243c401e53438baa36c16e4e35b`.
- Pratinjau lokal geometri kedua halaman diperiksa; tidak ditemukan konektor yang memotong oval atribut lain.
- Pemeriksaan langsung pada aplikasi draw.io belum dapat dilakukan karena akses native app dan browser pada sesi ini tidak tersedia. Pratinjau lokal bukan hasil render dari mesin draw.io.
