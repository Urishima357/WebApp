# Skema aktif sesuai ERD/LRS

Sumber: [ERD Garasi Hobby Priok.drawio](<../../ERD Garasi Hobby Priok.drawio>), halaman LRS Servis dan LRS Penjualan. Pengguna memilih dua database terpisah. Tidak memperluasnya dengan tabel dari PRD.

## Servis ? 7 tabel

| Induk | Anak | Kardinalitas |
|---|---|---|
| pelanggan | kendaraan | 1 : 0..N |
| kendaraan | nota_servis | 1 : 0..N |
| mekanik | nota_servis | 1 : 0..N |
| pegawai | nota_servis | 1 : 0..N |
| nota_servis | detail_servis | 1 : 1..N |
| nota_servis | pembayaran | 1 : 1 |

## Showroom ? 5 tabel

| Induk | Anak | Kardinalitas |
|---|---|---|
| pembeli | penjualan | 1 : 0..N |
| motor | penjualan | 1 : 0..1 |
| pegawai | penjualan | 1 : 0..N |
| penjualan | pembayaran | 1 : 1 |
| pegawai | pembayaran | 1 : 0..N |

PK dan FK memakai INT UNSIGNED. UK sumber dipertahankan, termasuk nomor polisi yang unik di masing-masing database. UNIQUE pembayaran.id_nota, pembayaran.id_penjualan, dan penjualan.id_motor menegakkan maksimum kardinalitas di atas. FK NOT NULL mengharuskan setiap anak terkait induk yang valid. Minimum satu anak per induk (detail/pembayaran) perlu ditangani dalam transaksi aplikasi; FK tidak memaksa induk sudah punya anak saat header baru dibuat.

String menjadi VARCHAR(255), decimal menjadi DECIMAL(18,2), datetime menjadi DATETIME. LRS tidak memberi panjang/precision/nullable, sehingga pilihan fisik awal tersebut dicatat eksplisit; semua kolom NOT NULL, tanpa kolom atau default bisnis tambahan. PK auto-increment. Engine InnoDB, utf8mb4, FK ON DELETE/UPDATE RESTRICT.

SQL dapat dibangun ulang langsung dari draw.io menggunakan scripts/database/erd_databases.py build. Apply tidak membuat tabel journal, tidak menjalankan DROP pada database aktif, dan menolak struktur existing yang tidak sama. Lihat [SQL aktif](../../apps/api/database/erd/README.md) dan [data dictionary](DATA_DICTIONARY.md).
