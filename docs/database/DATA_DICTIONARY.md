# Data Dictionary ? Sesuai LRS draw.io

Tidak menambahkan kolom dari PRD. Tipe fisik yang tidak dirinci LRS dijelaskan pada [SCHEMA.md](SCHEMA.md). Semua kolom NOT NULL; PK auto-increment.

## garasi_hobby_servis

### pelanggan

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_pelanggan | INT UNSIGNED | PK |
| nama | VARCHAR(255) |  |
| kontak | VARCHAR(255) |  |

### kendaraan

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_kendaraan | INT UNSIGNED | PK |
| id_pelanggan | INT UNSIGNED | FK ? pelanggan.id_pelanggan |
| no_polisi | VARCHAR(255) | UK |
| merek | VARCHAR(255) |  |
| tipe | VARCHAR(255) |  |
| tahun | INT |  |
| warna | VARCHAR(255) |  |

### nota_servis

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_nota | INT UNSIGNED | PK |
| id_kendaraan | INT UNSIGNED | FK ? kendaraan.id_kendaraan |
| id_mekanik | INT UNSIGNED | FK ? mekanik.id_mekanik |
| id_pegawai | INT UNSIGNED | FK ? pegawai.id_pegawai |
| no_work_order | VARCHAR(255) |  |
| tanggal | DATETIME |  |
| odometer | INT |  |
| keluhan | VARCHAR(255) |  |
| subtotal | DECIMAL(18,2) |  |
| diskon | DECIMAL(18,2) |  |
| total | DECIMAL(18,2) |  |

### mekanik

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_mekanik | INT UNSIGNED | PK |
| nama_mekanik | VARCHAR(255) |  |

### pegawai

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_pegawai | INT UNSIGNED | PK |
| nama_pegawai | VARCHAR(255) |  |
| jabatan | VARCHAR(255) |  |

### detail_servis

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_detail | INT UNSIGNED | PK |
| id_nota | INT UNSIGNED | FK ? nota_servis.id_nota |
| jenis | VARCHAR(255) |  |
| uraian | VARCHAR(255) |  |
| qty | DECIMAL(18,2) |  |
| harga | DECIMAL(18,2) |  |
| diskon | DECIMAL(18,2) |  |
| jumlah | DECIMAL(18,2) |  |

### pembayaran

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_pembayaran | INT UNSIGNED | PK |
| id_nota | INT UNSIGNED | FK ? nota_servis.id_nota; UNIQUE untuk kardinalitas |
| metode | VARCHAR(255) |  |
| diterima | DECIMAL(18,2) |  |
| kembalian | DECIMAL(18,2) |  |
| tanggal_konfirmasi | DATETIME |  |

## garasi_hobby_showroom

### pembeli

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_pembeli | INT UNSIGNED | PK |
| nama | VARCHAR(255) |  |
| kontak | VARCHAR(255) |  |
| alamat | VARCHAR(255) |  |

### penjualan

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_penjualan | INT UNSIGNED | PK |
| id_pembeli | INT UNSIGNED | FK ? pembeli.id_pembeli |
| id_motor | INT UNSIGNED | FK ? motor.id_motor; UNIQUE untuk kardinalitas |
| id_pegawai | INT UNSIGNED | FK ? pegawai.id_pegawai |
| tanggal_transaksi | DATETIME |  |
| subtotal | DECIMAL(18,2) |  |
| diskon | DECIMAL(18,2) |  |
| alasan_diskon | VARCHAR(255) |  |
| total | DECIMAL(18,2) |  |
| status | VARCHAR(255) |  |

### motor

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_motor | INT UNSIGNED | PK |
| kode_inventaris | VARCHAR(255) | UK |
| no_polisi | VARCHAR(255) | UK |
| merek | VARCHAR(255) |  |
| tipe | VARCHAR(255) |  |
| tahun | INT |  |
| warna | VARCHAR(255) |  |
| no_rangka | VARCHAR(255) | UK |
| no_mesin | VARCHAR(255) | UK |
| harga_jual | DECIMAL(18,2) |  |
| status | VARCHAR(255) |  |

### pegawai

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_pegawai | INT UNSIGNED | PK |
| nama_pegawai | VARCHAR(255) |  |
| jabatan | VARCHAR(255) |  |

### pembayaran

| Kolom | Tipe MySQL | Key / referensi |
|---|---|---|
| id_pembayaran | INT UNSIGNED | PK |
| id_penjualan | INT UNSIGNED | FK ? penjualan.id_penjualan; UNIQUE untuk kardinalitas |
| id_pegawai | INT UNSIGNED | FK ? pegawai.id_pegawai |
| metode | VARCHAR(255) |  |
| jumlah_diterima | DECIMAL(18,2) |  |
| referensi | VARCHAR(255) |  |
| tanggal_konfirmasi | DATETIME |  |
