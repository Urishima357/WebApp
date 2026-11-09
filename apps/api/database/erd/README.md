# SQL sesuai ERD draw.io

Sumber: `WebApp/ERD Garasi Hobby Priok.drawio`, halaman LRS Servis dan LRS Penjualan. Pemisahan menjadi dua database dipilih pengguna.

| Database | Tabel |
|---|---|
| `garasi_hobby_servis` — 7 | `pelanggan`, `kendaraan`, `nota_servis`, `mekanik`, `pegawai`, `detail_servis`, `pembayaran` |
| `garasi_hobby_showroom` — 5 | `pembeli`, `penjualan`, `motor`, `pegawai`, `pembayaran` |

Nama tabel lowercase mengikuti konfigurasi MySQL Windows; nama kolom tetap sama dengan LRS. PEGAWAI dan PEMBAYARAN tetap terpisah pada masing-masing database. Tidak ada tabel akun aplikasi, role, audit, stok, migrasi, atau tabel tambahan lainnya.

Pilihan fisik yang tidak dirinci LRS: string menjadi VARCHAR(255), decimal menjadi DECIMAL(18,2), datetime menjadi DATETIME; PK/FK menjadi INT UNSIGNED. PK auto-increment. Kolom disimpan NOT NULL pada terjemahan awal ini; LRS tidak memuat anotasi nullable. Tidak menambahkan nilai default/status bisnis dari PRD.

PK/FK/UK mengikuti LRS. UNIQUE tambahan pada FK pembayaran menegakkan maksimum satu pembayaran per nota/penjualan; UNIQUE penjualan.id_motor menegakkan 0..1 penjualan per motor. FK NOT NULL memastikan setiap anak memiliki induk. Minimum satu detail/pembayaran untuk setiap induk harus dipastikan melalui transaksi aplikasi karena FK tidak memaksa induk sudah mempunyai anak saat header baru dibuat.

Jalankan dari akar WebApp:

```powershell
python scripts/database/erd_databases.py build
python scripts/database/erd_databases.py apply
python scripts/database/verify.py
```

Apply menolak menimpa database dengan struktur yang berbeda. Tidak menjalankan DROP database aktif dan tidak membuat journal migration dalam database. Source lama yang memperluas PRD diarsipkan pada `docs/database/archive/prd-expansion/`; bukan schema aktif.
