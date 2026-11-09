# Data Dictionary MySQL — Usulan P0

Status: spesifikasi teknis dan referensi implementasi lokal, 8 November 2026. Sebanyak 42 tabel di bawah sudah dibuat melalui migration SQL; `payment_allocations` tetap desain bersyarat yang belum diterapkan. Journal teknis tambahan `schema_versions(version,sha256,applied_at)` mencatat migration yang dijalankan. Aturan proses dan keputusan terbuka berada di [SCHEMA.md](SCHEMA.md).

## Konvensi baca

| Notasi | Tipe / aturan |
|---|---|
| `ID` | `BIGINT UNSIGNED`; `id` adalah PK auto-increment kecuali disebut berbeda. FK ditulis `-> tabel.kolom`. |
| `MONEY` | `BIGINT`, Rupiah bulat; CHECK >= 0 kecuali field selisih yang dinyatakan signed. |
| `QTY`, `COST` | `DECIMAL(19,4)`; QTY merupakan satuan dasar kecuali dinyatakan satuan beli. |
| `DT` | `DATETIME(6)`, UTC. |
| `V(n)`, `TEXT`, `JSON`, `BOOL` | VARCHAR(n), TEXT, JSON, BOOLEAN; BOOL dibatasi 0/1 dengan CHECK. |
| `?` setelah tipe | Boleh NULL; tanpa tanda ini wajib NOT NULL. Nilai default NULL untuk kolom opsional kecuali dinyatakan lain. |
| `UQ`, `IX`, `G` | Unique index, index biasa, generated column. |
| `T` | Dua kolom `created_at DT`, `updated_at DT`, diisi server. Tidak ditambahkan jika tabel hanya menyebut timestamp append-only sendiri. |
| `A` | `created_by ID? -> users.id`, `updated_by ID? -> users.id`; NULL hanya untuk bootstrap sistem/seed. Aksi operasional harus mencatat aktor. |

Baris yang memuat beberapa nama berarti tiap nama mempunyai tipe/nullability yang sama. Kelompok baris detail menggunakan paket kolom bersama yang dieja di bagian 6. Semua FK mengikuti tipe target dan ON DELETE RESTRICT; tidak ada penghapusan master berantai. Nama constraint maksimal 64 karakter. Kolom kode/hash/reference memakai collation biner jika disebut; normalisasi login/SKU/rangka/mesin dilakukan sebelum UNIQUE.

## 1. Akses dan konfigurasi

### `roles`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| code | V(32) | UQ; seed `OWNER`, `WORKSHOP`, `SHOWROOM`, `LIMITED_INPUT`. |
| name | V(100) | Nama tampilan role. |
| is_active | BOOL | Default 1. |

### `permissions`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| code | V(100) | UQ; kunci permission PRD 10.2. |
| description | V(255) | Penjelasan akses. |

### `role_permissions`

| Kolom | Tipe | Definisi |
|---|---|---|
| role_id | ID | -> roles.id; bagian PK gabungan. |
| permission_id | ID | -> permissions.id; bagian PK gabungan. |

### `users`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| role_id | ID | -> roles.id; satu role per pengguna. |
| name | V(150) | Nama pengguna internal. |
| login | V(191) | UQ; trim dan normalisasi identitas login. Jenis input login dikunci pada kontrak autentikasi. |
| password | V(255) | Hash password kompatibel Laravel; bukan plaintext. |
| is_active | BOOL | Default 1; perubahan nonaktif mencabut sesi aktif. |
| last_login_at | DT? | Waktu login berhasil terakhir. |

### `user_permissions`

| Kolom | Tipe | Definisi |
|---|---|---|
| user_id, permission_id | ID | -> users.id, permissions.id; PK gabungan. |
| granted_by | ID | -> users.id; owner pemberi izin tambahan. |
| granted_at | DT | Waktu pemberian. |

Grant hanya tambahan, default tidak ada. Pencabutan grant menghapus baris pivot dengan audit; tidak menghapus histori aksi pengguna. Cakupan domain/hari/pemilik dokumen tetap diperiksa policy backend, bukan disimpulkan dari grant saja.

### `sessions`

| Kolom | Tipe | Definisi |
|---|---|---|
| id | V(255) | PK; session ID Laravel. |
| user_id | ID? | -> users.id; IX. NULL untuk sesi belum login. |
| ip_address | V(45)? | Metadata keamanan minimum; akses/retensi dibatasi. |
| user_agent | TEXT? | Metadata session framework. |
| payload | LONGTEXT | Data sesi server; tidak dikirim sebagai API resource. |
| last_activity | INT UNSIGNED | Unix seconds; IX untuk expiry/garbage collection. |

Session ID diregenerasi saat login. Logout/deaktivasi pengguna menghapus sesi terkait. TTL inactivity disimpan pada business_settings. Tidak menambahkan bearer token untuk SPA pada tahap ini.

### `business_locations`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| code | V(32) | UQ; satu lokasi default pada MVP. |
| name | V(150) | Nama lokasi. |
| address | TEXT | Alamat. |
| phone | V(50)? | Kontak lokasi. |
| is_default | BOOL | Default 0. |
| is_active | BOOL | Default 1. |
| active_default | TINYINT? G | IF(is_default = 1 AND is_active = 1, 1, NULL); UQ untuk maksimal satu default aktif. |

Seed/action memastikan minimal satu default aktif; UQ hanya memastikan maksimal satu. MVP tidak menyediakan UI multi-cabang.

### `business_settings`

| Kolom | Tipe | Definisi |
|---|---|---|
| key | V(100) | PK. |
| value | JSON | Nilai sesuai key dan value_type. |
| value_type | V(20) | `STRING`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `OBJECT`. |
| updated_by | ID? | -> users.id; NULL untuk bootstrap. |
| updated_at | DT | Waktu perubahan. |

Key awal: `business_identity`, `currency` = IDR, `timezone` = Asia/Jakarta, `estimate_revision_amount` = 50000, `estimate_revision_percent` = 10, `session_idle_minutes` usulan 30, `cutover_at` = NULL sampai cutover. `document_prefixes` menyimpan mapping prefix awal. Diskon menggunakan discount_policies, tidak digandakan di JSON. Tidak menyimpan gateway secret atau password database.

### `discount_policies`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| role_id | ID | -> roles.id. |
| transaction_type | V(16) | `SERVICE`, `POS`, `MOTOR`. |
| max_discount_percent | DECIMAL(7,4) | Default 0; CHECK 0..100. |
| updated_by | ID? | -> users.id. |

UQ `(role_id,transaction_type)`. Alasan diskon wajib walaupun nilainya masih di dalam batas.

### `document_sequences`

| Kolom | Tipe | Definisi |
|---|---|---|
| document_type | V(16) | Bagian PK; `WO`, `SRV`, `POS`, `MTR`, `GR`, `RFD`, `ADJ`, `KOR`. |
| period_yymm | CHAR(4) | Bagian PK; periode kalender Jakarta. |
| prefix | V(16) | Snapshot prefix penerbitan pada periode tersebut. |
| last_number | INT UNSIGNED | Default 0, CHECK <= 9999. |
| updated_at | DT | Perubahan atomik. |

PK `(document_type,period_yymm)`; `SELECT ... FOR UPDATE`/update atomik pada counter, bukan `MAX(number)+1`. Penerbitan nomor harus konsisten dengan rollback/retry; nomor dokumen yang sudah tersimpan tidak digunakan ulang.

## 2. Pelanggan, motor, dan master operasional

### `customers`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| name | V(150) | Wajib; IX. |
| contact | V(100)? | Kontak jika tersedia; IX biasa, tidak unik. |
| address, notes | TEXT? | Informasi opsional. |
| is_active | BOOL | Default 1; pelanggan lama tetap direferensikan histori. |

POS boleh memakai customer_id NULL; tidak membuat pelanggan palsu. Pelanggan bukan user login.

### `vehicles`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| license_plate | V(32)? | Normalisasi trim/case/spasi; IX biasa; duplikasi memberi warning. |
| brand, model | V(100) | Merek/model semua jenis motor; IX gabungan. |
| year | SMALLINT UNSIGNED? | Tahun jika diketahui; validasi rentang wajar oleh server. |
| color | V(80) | Warna motor. |
| chassis_number, engine_number | V(100)? | UQ masing-masing; kosong menjadi NULL, normalisasi trim/case. |
| notes | TEXT? | Catatan identitas. |
| is_active | BOOL | Default 1; penonaktifan mempertahankan semua referensi. |

`is_active` adalah tambahan teknis untuk lifecycle master (MST-10), bukan status inventaris showroom. Tahun atau nomor polisi tidak menjadi identitas utama kendaraan.

### `vehicle_ownerships`

Kolom bersama: `id ID`; append-only melalui action perpindahan, kecuali penutupan `valid_to` pada periode aktif dengan audit.

| Kolom | Tipe | Definisi |
|---|---|---|
| vehicle_id | ID | -> vehicles.id. |
| owner_type | V(16) | `CUSTOMER` atau `BUSINESS`. |
| customer_id | ID? | -> customers.id; wajib untuk CUSTOMER, NULL untuk BUSINESS. |
| location_id | ID? | -> business_locations.id; wajib untuk BUSINESS, NULL untuk CUSTOMER. |
| valid_from | DT | Awal interval. |
| valid_to | DT? | NULL = kepemilikan aktif; jika terisi harus > valid_from. |
| source_transaction_id | ID? | -> transactions.id; FK ditambahkan setelah tabel transaksi tersedia. |
| created_by | ID | -> users.id. |
| created_at | DT | Waktu pencatatan. |
| active_vehicle_id | ID? G | IF(valid_to IS NULL, vehicle_id, NULL); UQ. |

IX `(vehicle_id,valid_from)` dan `(customer_id,valid_to)`. CHECK pasangan owner_type/FK; cegah overlap interval dalam action dengan lock vehicle. Dokumen servis menyimpan pelanggan yang dilayani saat kunjungan, bukan selalu mengikuti pemilik terkini.

### `operational_staff`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| location_id | ID | -> business_locations.id. |
| name | V(150) | Nama mekanik/PIC. |
| staff_type | V(16) | `MECHANIC` atau `PIC`. |
| is_active | BOOL | Default 1; bukan akun login. |

### `item_categories`

Kolom bersama: `id ID`, `T`, `A`. Kolom khusus: `name V(100)` wajib, `is_active BOOL` default 1. Nama kategori dinormalisasi dan unik sebagai usulan teknis agar pilihan tidak ambigu.

### `units`

Kolom bersama: `id ID`, `T`, `A`. Kolom khusus: `code V(20)` UQ, `name V(80)` wajib, `is_active BOOL` default 1. Contoh satuan ditetapkan saat data awal; tidak mengubah satuan item yang sudah bergerak.

### `items`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| sku | V(64) | UQ; normalisasi kode. |
| name | V(150) | Nama barang; IX. |
| category_id | ID | -> item_categories.id. |
| brand | V(100)? | Merek opsional. |
| base_unit_id | ID | -> units.id; tidak berubah setelah movement pertama. |
| purchase_unit_id | ID? | -> units.id; NULL berarti memakai satuan dasar. |
| purchase_ratio | QTY | Default 1, CHECK > 0; NULL purchase_unit mewajibkan rasio 1. |
| selling_price | MONEY | Harga master; hanya pengguna berizin mengubahnya. |
| min_stock | QTY | Default 0, CHECK >= 0. |
| is_stock_tracked | BOOL | Default 1; perubahan setelah movement memerlukan review, bukan menghilangkan ledger lama. |
| is_active | BOOL | Default 1. |

WAC bukan kolom global items: disimpan per lokasi di inventory_balances. Lokasi rak opsional P1; tidak diwajibkan saat input P0.

### `inventory_balances`

| Kolom | Tipe | Definisi |
|---|---|---|
| item_id, location_id | ID | -> items.id, business_locations.id; PK gabungan. |
| current_stock | QTY | Default 0, CHECK >= 0. |
| weighted_average_cost | COST | Default 0, CHECK >= 0; tidak diedit langsung. |
| updated_at | DT | Waktu proyeksi terakhir. |

Row saldo dibuat saat item/lokasi disiapkan, bukan ketika dua pengguna bersamaan mulai melakukan posting. Saldo kuantitas harus sama dengan SUM(quantity_in - quantity_out) ledger. Rekonsiliasi WAC mengikuti urutan posting dan biaya historis, bukan rata-rata master terbaru.

### `suppliers`

Kolom bersama: `id ID`, `T`, `A`. Kolom khusus: `name V(150)`, `contact V(100)?`, `address TEXT?`, `is_active BOOL` default 1. Nama wajib dan dapat dicari; kontak tidak unik.

### `service_catalog`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| name | V(150) | Nama jasa. |
| service_type | V(16) | `INTERNAL`, `EXTERNAL_VENDOR`. |
| standard_price | MONEY | Harga standar. |
| vendor_cost | MONEY? | Wajib untuk EXTERNAL_VENDOR; INTERNAL boleh NULL. |
| notes | TEXT? | Catatan. |
| is_active | BOOL | Default 1. |

Jasa tidak menghasilkan stock movement. Biaya vendor di-snapshot pada aktual dan baris tagihan; biaya tenaga kerja internal belum dimodelkan.

## 3. Barang masuk, adjustment, dan ledger

### `goods_receipts`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| number | V(40) | UQ; prefix GR. |
| supplier_id, location_id | ID | -> suppliers.id, business_locations.id. |
| supplier_reference | V(100)? | Referensi nota supplier; tidak diasumsikan unik global. |
| received_at | DT | Tanggal penerimaan aktual. |
| status | V(24) | Default DRAFT; DRAFT/FINAL/CANCELLED. |
| total | MONEY | Default 0; wajib cocok jumlah detail saat Final. |
| finalized_by, cancelled_by | ID? | -> users.id; wajib sesuai status. |
| finalized_at, cancelled_at | DT? | Waktu aksi. |
| cancellation_reason | TEXT? | Wajib bila dibatalkan. |

### `goods_receipt_lines`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| goods_receipt_id | ID | -> goods_receipts.id. |
| item_id | ID | -> items.id. |
| purchase_unit_id | ID | -> units.id; satuan input saat penerimaan. |
| quantity_purchased | QTY | CHECK > 0. |
| conversion_ratio | QTY | CHECK > 0; snapshot, tidak mengikuti perubahan master berikutnya. |
| quantity_base | QTY | Hasil konversi yang tervalidasi; > 0 dan dapat diwakili presisi 4 desimal. |
| purchase_unit_price | COST | Harga per satuan beli, >= 0. |
| unit_cost_base | COST | Harga per satuan dasar, half-up 4 desimal. |
| line_total | MONEY | Nilai Rupiah baris sesuai pembulatan. |

Tidak menyimpan FK purchase_request atau supplier_return P1 pada tahap awal. Action menghitung nilai, bukan menerima hasil perkalian client sebagai kebenaran.

### `stock_adjustments`

Kolom bersama: `id ID`, `T`, `A`. Kolom khusus: `number V(40)` UQ prefix ADJ, `location_id ID -> business_locations.id`, `status V(24)` default DRAFT, `reason TEXT` wajib, `finalized_by ID? -> users.id`, `finalized_at DT?`, `cancelled_by ID? -> users.id`, `cancelled_at DT?`, `cancellation_reason TEXT?`.

### `stock_adjustment_lines`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| stock_adjustment_id | ID | -> stock_adjustments.id. |
| item_id | ID | -> items.id. |
| quantity_delta | QTY | Signed, CHECK <> 0. |
| unit_cost | COST | >= 0; snapshot WAC untuk keluar, biaya beralasan/berizin untuk masuk. |
| notes | TEXT? | Penjelasan detail. |

### `stock_movements`

Kolom bersama: `id ID`. Append-only, tidak memiliki updated_at.

| Kolom | Tipe | Definisi |
|---|---|---|
| item_id, location_id | ID | -> items.id, business_locations.id. |
| movement_type | V(24) | RECEIPT, WO_USAGE, POS_SALE, ADJUSTMENT, OPENING, REVERSAL. |
| quantity_in, quantity_out | QTY | Default 0; tepat satu > 0, yang lain 0. |
| unit_cost | COST | >= 0; snapshot biaya saat posting atau biaya historis reversal. |
| goods_receipt_line_id | ID? | -> goods_receipt_lines.id; sumber RECEIPT. |
| work_order_item_id | ID? | -> work_order_items.id; sumber WO_USAGE. |
| transaction_line_id | ID? | -> transaction_lines.id; sumber POS_SALE. |
| stock_adjustment_line_id | ID? | -> stock_adjustment_lines.id; sumber ADJUSTMENT. |
| migration_batch_id | ID? | -> migration_batches.id; sumber OPENING. |
| reversal_of_id | ID? | -> stock_movements.id; sumber REVERSAL. |
| posting_key | V(191) | UQ/biner; kunci stabil posting sumber. |
| reason | TEXT? | Wajib adjustment/reversal; opening mencatat referensi batch. |
| created_by | ID | -> users.id; operator/admin migrasi. |
| occurred_at | DT | Waktu posting server; pasangan id memberi urutan stabil. |
| opening_item_id | ID? G | IF(movement_type = 'OPENING', item_id, NULL); UQ gabungan dengan location_id. |

CHECK tepat satu FK sumber non-NULL dan cocok dengan movement_type. Sumber asli reversal hanya ditelusuri melalui reversal_of_id, tidak mengisi FK asal dua kali. Cocokkan item/lokasi sumber di action. Reversal kumulatif tidak boleh melebihi asal; posting_key baru setiap kejadian reversal yang sah, retry menggunakan key yang sama. Satu OPENING per item/lokasi; koreksi berikutnya melalui adjustment/reversal berizin, bukan opening kedua.

## 4. Bengkel

### `work_orders`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| number | V(40) | UQ; prefix WO. |
| vehicle_id, customer_id, location_id | ID | -> vehicles.id, customers.id, business_locations.id. |
| operational_staff_id | ID? | -> operational_staff.id; PIC dapat belum dipilih pada Draft. |
| received_at | DT | Waktu masuk. |
| complaint | TEXT? | Boleh belum lengkap pada Draft; wajib sebelum inspeksi diproses. |
| odometer_km | INT UNSIGNED? | Kilometer jika diketahui. |
| initial_condition, inspection_notes, recommendations | TEXT? | Kondisi awal/hasil pemeriksaan. |
| status | V(32) | Default DRAFT; kode pada SCHEMA.md. |
| inspected_at, handed_over_at, cancelled_at | DT? | Waktu tahap terkait. |
| cancellation_reason | TEXT? | Wajib saat CANCELLED. |

Jenis WO internal rekondisi/garansi tidak ditambahkan sebelum OQ-16/17 diputuskan. Tidak menyimpan `transaction_id` balik; transaksi mereferensikan WO.

### `work_order_status_history`

Kolom bersama: `id ID`; append-only.

| Kolom | Tipe | Definisi |
|---|---|---|
| work_order_id | ID | -> work_orders.id. |
| from_status | V(32)? | NULL untuk pembuatan awal. |
| to_status | V(32) | Status setelah aksi. |
| reason | TEXT? | Wajib untuk pembatalan/override. |
| changed_by | ID | -> users.id. |
| changed_at | DT | Waktu perubahan. |

### `estimates`

Kolom bersama: `id ID`, `T`, `A`, paket `DISCOUNT` di bagian 6.

| Kolom | Tipe | Definisi |
|---|---|---|
| work_order_id | ID | -> work_orders.id. |
| version | INT UNSIGNED | Mulai 1; UQ gabungan dengan work_order_id. |
| status | V(16) | PENDING/APPROVED/REJECTED/REVISED; awal PENDING. |
| subtotal, total | MONEY | Default 0 untuk draft belum memiliki rincian; dihitung server. |
| approval_name | V(150)? | Nama pemberi persetujuan pelanggan. |
| approval_method | V(16)? | IN_PERSON/PHONE/WHATSAPP. |
| approved_at | DT? | Waktu keputusan pelanggan. |
| approved_total | MONEY? | Snapshot nilai disetujui. |
| approval_recorded_by | ID? | -> users.id; staf pencatat, bukan user pelanggan. |
| approval_evidence_key | V(255)? | Lampiran privat opsional; validasi dan kebijakan storage seperti upload gambar. |
| decision_notes | TEXT? | Alasan penolakan/revisi jika ada. |
| override_by | ID? | -> users.id; owner berizin. |
| override_at | DT? | Waktu override. |
| override_reason | TEXT? | Wajib untuk override; tidak memalsukan persetujuan pelanggan. |

Versi lama tidak ditimpa; versi aktif ditentukan dari nomor versi terbesar di bawah lock WO. Persetujuan terakhir ditelusuri dari versi APPROVED dan snapshotnya, bukan total master terbaru.

### `estimate_lines`

Kolom bersama: `id ID`, `T`, paket `SERVICE_ITEM_LINE` dan `DISCOUNT` di bagian 6. Kolom khusus: `estimate_id ID -> estimates.id`. Item/jasa adalah rencana, tidak membuat movement.

### `work_order_items`

Kolom bersama: `id ID`, `T`, `A`, paket `SERVICE_ITEM_LINE` dan `DISCOUNT`.

| Kolom | Tipe | Definisi |
|---|---|---|
| work_order_id | ID | -> work_orders.id. |
| source_estimate_line_id | ID? | -> estimate_lines.id; harus berasal dari WO sama. |
| usage_status | V(16) | Default PLANNED; PLANNED/CONFIRMED/REVERSED. |
| confirmed_by | ID? | -> users.id. |
| confirmed_at | DT? | Waktu aktual dikonfirmasi. |
| change_notes | TEXT? | Perbedaan dari estimasi. |

Untuk MVP, satu konfirmasi barang mem-posting seluruh quantity detail; tambahan pengambilan dibuat sebagai detail baru. Pengembalian parsial ditelusuri dari reversal kumulatif; status REVERSED hanya jika seluruh pemakaian dibalik. Jasa/non-stock dikonfirmasi tanpa ledger. FK movement berada pada stock_movements, tidak menduplikasi stock_movement_id pada work_order_items.

## 5. Showroom dan foto

### `showroom_inventories`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| vehicle_id | ID | -> vehicles.id; UQ, satu record inventaris per identitas motor pada baseline. |
| location_id | ID | -> business_locations.id. |
| inventory_code | V(64) | UQ. |
| purchase_cost | MONEY? | NULL selama draft belum diisi owner; wajib sebelum ditawarkan/dijual. Harga modal tidak dapat dibaca staf. |
| selling_price | MONEY? | NULL pada draft belum lengkap; wajib sebelum AVAILABLE/RESERVED/SOLD. |
| status | V(16) | Default DRAFT. |
| condition_notes | TEXT? | Kondisi motor. |
| reserved_customer_id | ID? | -> customers.id; wajib saat RESERVED. |
| reserved_at, reserved_until | DT? | Wajib saat RESERVED; until > at. Durasi default belum ditetapkan. |
| reservation_notes | TEXT? | Catatan reservasi/override. |

Motor masuk inventaris menggunakan vehicles lama jika sudah ada; penutupan/bukaan ownership mengikuti OQ-15 baseline. Reacquisition historis berulang memerlukan review model inventaris satu-record ini sebelum alur pengadaan lanjutan dibuat; tidak membuat identitas fisik baru.

### `vehicle_photos`

Kolom bersama: `id ID`; metadata media, bukan BLOB.

| Kolom | Tipe | Definisi |
|---|---|---|
| vehicle_id | ID | -> vehicles.id. |
| work_order_id | ID? | -> work_orders.id; NULL untuk foto showroom. |
| photo_type | V(24) | SHOWROOM_FRONT/SHOWROOM_RIGHT/SHOWROOM_LEFT/SHOWROOM_OTHER/WO_GENERAL/WO_ISSUE/WO_DAMAGE. |
| object_key | V(255) | UQ/biner; kunci objek privat, bukan public URL permanen. |
| mime_type | V(64) | JPEG/PNG/WebP saja melalui validasi isi file server. |
| size_bytes | INT UNSIGNED | CHECK >0 dan <=5242880 (batas teknis 5 MiB usulan); disejajarkan dengan batas aplikasi saat implementasi. |
| sort_order | INT UNSIGNED | Default 0. |
| is_primary | BOOL | Default 0; hanya untuk foto showroom. |
| uploaded_by | ID | -> users.id. |
| uploaded_at | DT | Waktu unggah. |
| primary_showroom_vehicle_id | ID? G | IF(work_order_id IS NULL AND is_primary = 1, vehicle_id, NULL); UQ. |

CHECK jenis foto sesuai nullable work_order_id; foto WO tidak boleh is_primary=1 dan harus memakai vehicle yang sama dengan WO (action). AVAILABLE butuh depan/kanan/kiri; pengerjaan WO butuh umum/masalah dan foto kerusakan tambahan bila ada. Validasi file membuang metadata lokasi. Retry object_key yang sama tidak menggandakan metadata. Retensi/penghapusan foto menunggu kebijakan; tidak menghapus catatan historis tanpa audit.

## 6. Paket kolom rincian dan diskon

### Paket `DISCOUNT`

Paket ini digunakan pada estimates, estimate_lines, work_order_items, transactions, dan transaction_lines. Pada header, diskon paket berarti diskon tambahan header; total diskon seluruh transaksi menjumlah diskon baris dan header.

| Kolom | Tipe | Definisi |
|---|---|---|
| discount_type | V(8) | Default NONE; NONE/AMOUNT/PERCENT. |
| discount_input | DECIMAL(19,4) | Default 0; >=0, persen <=100; AMOUNT harus Rupiah bulat. |
| discount_amount | MONEY | Default 0; hasil konversi server, bukan dihitung lagi dengan master baru. |
| discount_reason | TEXT? | Wajib bila discount_amount >0. |

NONE mewajibkan input/amount=0. Diskon tidak boleh melebihi gross basis. Kenaikan/penurunan harga satuan oleh staf diganti alur diskon sesuai PRD, bukan endpoint bebas edit harga.

### Paket `SERVICE_ITEM_LINE`

| Kolom | Tipe | Definisi |
|---|---|---|
| line_type | V(16) | ITEM atau SERVICE. |
| item_id | ID? | -> items.id; wajib hanya untuk ITEM. |
| service_id | ID? | -> service_catalog.id; wajib hanya untuk SERVICE. |
| description_snapshot | V(255) | Nama/keterangan pada saat dokumen dibuat. |
| quantity | QTY | CHECK >0. |
| unit_price | MONEY | Harga satuan snapshot. |
| cost_snapshot | COST | >=0; item memakai WAC, jasa vendor memakai biaya vendor, jasa internal 0 sebagai baseline estimasi biaya yang belum dimodelkan. |
| line_subtotal | MONEY | Gross hasil pembulatan per baris. |
| line_total | MONEY | line_subtotal - discount_amount. |

CHECK XOR item/service sesuai line_type; foreign key asli dipertahankan selain snapshot. Estimasi cost_snapshot hanya indikatif dan privat; WAC historis aktual dikunci saat barang dikeluarkan.

## 7. Transaksi dan approval

### `transactions`

Kolom bersama: `id ID`, `T`, `A`, paket `DISCOUNT`.

| Kolom | Tipe | Definisi |
|---|---|---|
| number | V(40) | UQ; SRV/POS/MTR/KOR sesuai dokumen. |
| transaction_type | V(16) | SERVICE/POS/MOTOR; kategori bisnis/pendapatan. |
| document_type | V(8) | Default NORMAL; NORMAL/KOR. |
| corrects_transaction_id | ID? | -> transactions.id; wajib hanya KOR; tipe sama dengan asal, tidak bersiklus. |
| customer_id | ID? | -> customers.id; wajib SERVICE/MOTOR; opsional POS. |
| location_id | ID | -> business_locations.id. |
| work_order_id | ID? | -> work_orders.id; wajib hanya SERVICE. |
| showroom_inventory_id | ID? | -> showroom_inventories.id; wajib hanya MOTOR. |
| transaction_at | DT | Waktu transaksi server. |
| subtotal, total | MONEY | Default 0 saat draft; subtotal sebelum diskon, total setelah seluruh diskon. |
| status | V(24) | Default DRAFT; DRAFT/AWAITING_PAYMENT/FINAL/CANCELLED. |
| receipt_snapshot | JSON? | Wajib saat Final: identitas usaha/pelanggan/motor/pembayaran sesuai dokumen; tidak berisi secret. |
| finalized_by, cancelled_by | ID? | -> users.id; actor NULL di finalized_by hanya untuk finalisasi otomatis gateway, dengan jejak sistem/provider di audit. |
| finalized_at, cancelled_at | DT? | Waktu aksi sesuai status. |
| cancellation_reason | TEXT? | Wajib saat dibatalkan. |
| final_work_order_id | ID? G | IF(status='FINAL', work_order_id, NULL); UQ. |
| final_showroom_inventory_id | ID? G | IF(status='FINAL', showroom_inventory_id, NULL); UQ. |
| active_corrects_transaction_id | ID? G | IF(status<>'CANCELLED', corrects_transaction_id, NULL); UQ, maksimal satu pengganti aktif per asal. |

IX pada SCHEMA.md. CHECK konsistensi tipe bisnis dan sumber; kondisi asal sudah dibatalkan, tidak ada siklus KOR, kecocokan customer/lokasi/vehicle, dan minimal satu detail saat Final ditegakkan dalam action. SERVICE/POS/MOTOR tidak dicampur dalam satu transaksi MVP.

### `transaction_lines`

Kolom bersama: `id ID`, `T`, paket `DISCOUNT`.

| Kolom | Tipe | Definisi |
|---|---|---|
| transaction_id | ID | -> transactions.id. |
| line_type | V(16) | ITEM/SERVICE/MOTOR. |
| item_id | ID? | -> items.id; hanya ITEM. |
| service_id | ID? | -> service_catalog.id; hanya SERVICE. |
| showroom_inventory_id | ID? | -> showroom_inventories.id; hanya MOTOR. |
| work_order_item_id | ID? | -> work_order_items.id; asal aktual SERVICE jika relevan. |
| description_snapshot | V(255) | Identitas baris historis. |
| quantity | QTY | >0; MOTOR tepat 1. |
| unit_price | MONEY | Harga satuan snapshot yang dikunci. |
| cost_snapshot | COST | >=0; WAC/vendor/modal motor sesuai jenis. |
| line_subtotal, line_total | MONEY | Gross dan net setelah diskon baris; diskon header tidak digandakan. |

CHECK tepat satu FK item/service/inventory sesuai jenis. Detail MOTOR tepat satu dan cocok dengan header; POS hanya ITEM; SERVICE dari aktual WO yang sama. Baris final tidak diedit meskipun master berubah.

### `discount_approvals`

Kolom bersama: `id ID`; keputusan lama dipertahankan.

| Kolom | Tipe | Definisi |
|---|---|---|
| transaction_id | ID? | -> transactions.id. |
| estimate_id | ID? | -> estimates.id; tepat satu target, XOR dengan transaction_id. |
| requested_by | ID | -> users.id. |
| decided_by | ID? | -> users.id; owner berizin. |
| subtotal_before, discount_amount, total_after | MONEY | Snapshot nilai yang diminta. |
| policy_limit_percent | DECIMAL(7,4) | Snapshot batas role/jenis saat permintaan. |
| content_hash | CHAR(64) | SHA-256/biner dari representasi canonical isi/harga/diskon yang disetujui. |
| reason | TEXT | Alasan wajib. |
| status | V(16) | Default PENDING; PENDING/APPROVED/REJECTED. |
| requested_at | DT | Waktu permintaan. |
| decided_at | DT? | Waktu keputusan. |

Menambah target estimate adalah normalisasi teknis untuk WKS-05; approval tidak hanya dimiliki transaksi akhir. Mutation isi mengharuskan approval baru; persetujuan lama tidak ditimpa.

## 8. Pembayaran, event, dan refund

### `payment_methods`

Kolom bersama: `id ID`, `T`, `A`.

| Kolom | Tipe | Definisi |
|---|---|---|
| code | V(32) | UQ; CASH/BANK_TRANSFER/QRIS/EWALLET. |
| name | V(100) | Label UI. |
| mode | V(8) | MANUAL/GATEWAY. |
| channel | V(32) | Kode channel yang dikirim adapter. |
| provider | V(64)? | Wajib jika metode gateway diaktifkan; bukan secret. |
| is_active | BOOL | Default 0; seed mengaktifkan manual, gateway setelah konfigurasi valid. |

### `payment_attempts`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| transaction_id | ID | -> transactions.id; asal penerimaan dana, tidak dipindah ketika KOR. |
| payment_method_id | ID | -> payment_methods.id. |
| mode_snapshot | V(8) | MANUAL/GATEWAY saat attempt dibuat. |
| channel_snapshot | V(32) | Channel historis. |
| provider | V(64)? | Provider historis; wajib gateway. |
| internal_reference | V(100) | UQ/biner; kunci request provider dan rekonsiliasi. |
| external_reference | V(191)? | Referensi provider; UQ gabungan provider/reference. |
| amount_due | MONEY | Nilai yang diminta saat detail transaksi dikunci. |
| amount_received, change_amount | MONEY | Default 0; non-tunai sama dengan tagihan dan change=0 saat sah; tunai boleh lebih. |
| status | V(24) | Default PENDING; state pada SCHEMA.md. |
| payment_reference | V(191)? | Referensi verifikasi transfer manual jika ada. |
| confirmed_by | ID? | -> users.id; wajib manual yang sudah dikonfirmasi, NULL untuk sistem gateway. |
| requested_by | ID | -> users.id; peminta internal. |
| requested_at | DT | Waktu attempt dibuat. |
| expires_at, paid_at | DT? | Expiry provider dan waktu penerimaan yang terverifikasi. |
| funded_transaction_id | ID? G | IF(status IN ('PAID','REFUND_PENDING','REFUNDED'), transaction_id, NULL); UQ. |

CHECK amount_received >= change_amount; status yang memiliki histori dana membutuhkan paid_at. Perubahan master tidak mengubah snapshot. Satu attempt Pending/unknown harus direkonsiliasi sebelum retry membuat potensi penerimaan ganda; unique constraint tidak dapat mencegah pelanggan benar-benar membayar dua request eksternal. Dana kedua yang telanjur diterima masuk kasus rekonsiliasi/refund, tidak disembunyikan dengan error DB.

### `payment_gateway_events`

Kolom bersama: `id ID`; log event terverifikasi, append-only untuk isi event; processing_status boleh berubah.

| Kolom | Tipe | Definisi |
|---|---|---|
| provider | V(64) | Biner; provider terkonfigurasi. |
| external_event_id | V(191) | Biner, wajib; UQ gabungan provider/event. Adapter membentuk kunci deterministik bila tidak ada ID native. |
| external_reference | V(191) | Biner; tetap tersimpan jika attempt belum ditemukan. |
| payment_attempt_id | ID? | -> payment_attempts.id; nullable untuk callback datang lebih dahulu. |
| event_type | V(64) | Tipe event provider. |
| signature_valid | BOOL | Harus 1 untuk event yang masuk tabel ini. Invalid signature hanya log teknis tersanitasi, tidak boleh mengambil kunci deduplikasi event sah. |
| payload_hash | CHAR(64) | Hash/biner payload asli untuk diagnosis; bukan pengganti signature. |
| payload_redacted | JSON? | Field minimum yang diperlukan; tanpa token, secret, atau PII berlebihan. |
| processing_status | V(24) | Default RECEIVED; RECEIVED/PROCESSED/RECONCILE/REJECTED. |
| received_at | DT | Waktu backend menerima event. |
| processed_at | DT? | Waktu pemrosesan terakhir. |
| processing_error | V(255)? | Kode/pesan aman untuk rekonsiliasi. |

Verifikasi merchant, nominal, dan reference sebelum posting dana. Event valid tetapi nominal/merchant/reference tidak cocok tidak membuat Paid; tandai REJECTED/RECONCILE sesuai hasil adapter. Jangan menganggap JSON redacted cukup untuk memverifikasi ulang signature: verifikasi dilakukan terhadap payload asli sebelum redaksi.

### `refunds`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| number | V(40) | UQ; prefix RFD. |
| transaction_id | ID | -> transactions.id; dokumen yang memicu refund. |
| payment_attempt_id | ID | -> payment_attempts.id; sumber dana asli. |
| payment_method_id | ID | -> payment_methods.id; harus sama dengan asal. |
| amount | MONEY | CHECK >0. |
| recipient | V(150)? | Boleh belum diisi saat otomatis Pending; wajib ketika diselesaikan. |
| reason | TEXT | Alasan wajib. |
| status | V(24) | Default REFUND_PENDING; REFUND_PENDING/REFUNDED. |
| internal_reference | V(100) | UQ/biner. |
| external_reference | V(191)? | Referensi transfer/provider; wajib jika metode memerlukannya saat selesai. |
| requested_by | ID | -> users.id; owner pemicu pembatalan. |
| confirmed_by | ID? | -> users.id; pengguna berizin yang menyelesaikan. |
| requested_at | DT | Waktu pembuatan. |
| confirmed_at | DT? | Wajib saat REFUNDED. |

Agregat refund Pending/Refunded dibatasi dana bersih yang tidak lagi dialokasikan, di bawah row lock. Refund biasa dibuat otomatis saat pembatalan berbayar; KOR tidak memicu refund penuh atas dana yang dialihkan. Gateway refund baseline manual/provider dashboard sampai keputusan integrasi dibuat.

### `payment_allocations` — desain bersyarat KOR

Kolom bersama: `id ID`. Struktur ini **belum untuk migration pembayaran tanpa review keputusan KOR**, termasuk penafsiran batas satu Paid dan metode selisih.

| Kolom | Tipe | Definisi |
|---|---|---|
| payment_attempt_id | ID | -> payment_attempts.id; dana asal. |
| transaction_id | ID | -> transactions.id; dokumen penerima alokasi. |
| amount_applied | MONEY | CHECK >0. |
| allocated_by | ID? | -> users.id; NULL hanya aksi otomatis sistem. |
| allocated_at | DT | Waktu alokasi. |
| released_by | ID? | -> users.id. |
| released_at | DT? | NULL = alokasi aktif. |
| release_reason | TEXT? | Wajib saat dilepas. |

Usulan UQ bersyarat `(payment_attempt_id, active_transaction_id)` dengan `active_transaction_id = IF(released_at IS NULL, transaction_id, NULL)`, tipe ID nullable G. Pelepasan tidak menghapus baris. Invariant dana dan Final dibahas pada SCHEMA.md; desain ini bukan izin split payment MVP.

## 9. Audit, migrasi, dan idempotensi

### `audit_logs`

Kolom bersama: `id ID`; append-only, tidak memiliki updated_at.

| Kolom | Tipe | Definisi |
|---|---|---|
| actor_id, requester_id, approver_id | ID? | -> users.id; actor NULL untuk event sistem/provider. |
| module | V(64) | Modul sumber. |
| action | V(100) | Kode aksi. |
| entity_type | V(64) | Jenis objek; referensi audit, bukan FK polimorfik bisnis. |
| entity_id | V(100)? | ID objek untuk histori audit. |
| document_number | V(40)? | Nomor referensi yang dapat dicari. |
| before_data, after_data | JSON? | Nilai penting yang disanitasi; tidak menyalin password/session payload. |
| reason | TEXT? | Alasan sesuai aksi. |
| provider_reference | V(191)? | Referensi provider tersanitasi. |
| correlation_id | CHAR(36) | ID korelasi request/job, IX. |
| occurred_at | DT | Waktu server. |

Owner hanya membaca/filter. Tidak ada API edit/delete audit; permission aplikasi saja tidak melindungi dari DBA, sehingga akses operasional DB dan backup juga dibatasi.

### `migration_batches`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| reference | V(100) | UQ; referensi batch. |
| dataset_code | V(32) | Jenis dataset, misalnya OPENING_ITEMS atau ACTIVE_VEHICLES. |
| location_id | ID | -> business_locations.id. |
| source_filename | V(255) | Nama sumber, tidak menyimpan path rahasia komputer. |
| source_hash | CHAR(64) | Hash/biner sumber. |
| cutover_at | DT | Waktu mulai pencatatan operasional. |
| status | V(16) | VALIDATED/IMPORTED/FAILED. |
| accepted_rows, rejected_rows | INT UNSIGNED | Default 0. |
| validation_report | JSON? | Nomor baris, kode error, ringkasan; hindari PII berlebih. |
| executed_by | ID | -> users.id; operator migrasi. |
| executed_at | DT? | Waktu posting; NULL sebelum impor. |

UQ `(dataset_code,location_id,source_hash)`; ulang batch memakai referensi yang sama. Batch tidak dianggap IMPORTED sebelum semua posting yang disepakati committed. Opening memiliki constraint tambahan per item/lokasi pada ledger agar file berbeda tidak menggandakan opening.

### `idempotency_keys`

Kolom bersama: `id ID`, `T`.

| Kolom | Tipe | Definisi |
|---|---|---|
| user_id | ID | -> users.id; request API terautentikasi, bukan login/webhook. |
| operation | V(64) | Nama aksi dan scope dokumen yang konsisten. |
| idempotency_key | V(128) | Biner; key request. |
| request_hash | CHAR(64) | Hash/biner request canonical. |
| status | V(16) | PROCESSING/COMPLETED. |
| response_status | SMALLINT UNSIGNED? | HTTP status hasil selesai. |
| response_body | JSON? | Hasil minimum untuk replay; tidak menyimpan cookie/token/secret. |
| resource_type | V(64)? | Referensi hasil operasi. |
| resource_id | V(100)? | ID hasil untuk pemulihan/replay. |
| completed_at | DT? | Waktu hasil tersedia. |
| expires_at | DT? | Retensi teknis ditetapkan saat implementasi; jangan purge key selama operasi masih ambigu/aktif. |

UQ `(user_id,operation,idempotency_key)`. Hasil bisnis dan status COMPLETED ditulis dalam satu transaksi. Request hash berbeda untuk key yang sama ditolak; error retryable tidak dipermanenkan sebagai sukses. Webhook menggunakan deduplikasi payment_gateway_events, ledger menggunakan posting_key. Expiry key API tidak menggantikan constraint unik bisnis permanen.

## 10. Batas dokumen

Jumlah/struktur tabel merupakan normalisasi teknis. Implementasi lokal tidak otomatis menutup keputusan bisnis pada PRD. SQL fisik, seed, dan pengujian MySQL tersedia; API resource, action bisnis Laravel, serta seluruh UAT aplikasi belum diimplementasikan. Lihat [setup dan batas keamanan](../../infra/mysql/README.md). Status waktu/data privat dan perilaku domain tetap mengikuti [skema](SCHEMA.md), bukan disimpulkan dari nullability saja.
