# Pilot integrasi bengkel

Pilot menghubungkan React, Laravel 13, dan MySQL InnoDB untuk alur bengkel dengan data uji. Pilih **Buka pilot bengkel** di layar masuk atau buka **http://127.0.0.1:5180/#/pilot**. Login pilot memakai akun server tersendiri.

## Menjalankan pilot lokal

Butuh PHP 8.3+ dengan PDO MySQL, cURL, Fileinfo, Mbstring, OpenSSL dan ZIP, Composer, Python, serta [runtime MySQL lokal](../../infra/mysql/README.md). Skrip menggunakan PHP portable dari .tools jika tersedia.

Dari root repo, instal dependensi API dengan Composer yang memakai PHP 8.3+. Pada mesin yang masih memakai PHP 8.2 di PATH, gunakan contoh PHP portable di bawah. Sesuaikan lokasi Composer PHAR bila perlu.

~~~powershell
# Jika PHP pada PATH sudah 8.3+
composer --working-dir=apps/api install

# Alternatif dengan PHP portable
$pilotPhp = (Resolve-Path '.tools/php-8.3.36-1/php.exe').Path
$pilotExt = (Resolve-Path '.tools/php-8.3.36-1/ext').Path
& $pilotPhp -n -d "extension_dir=$pilotExt" -d extension=curl -d extension=mbstring -d extension=openssl -d extension=zip C:/composer/composer.phar --working-dir=apps/api install

python scripts/database/pilot.py setup
python scripts/database/pilot.py account owner@garasi.test owner "Owner pilot"
python scripts/database/pilot.py serve
~~~

Perintah pembuatan akun meminta kata sandi secara interaktif. Owner mengelola katalog dan pemasok, staf bengkel mengerjakan WO, dan staf gudang memproses barang masuk. Server API memakai 127.0.0.1:8000. Di terminal kedua, jalankan frontend.

~~~powershell
cd apps/web
npm ci
npm run dev
~~~

Setup membuat database **garasi_hobby_pilot** dan menyimpan kredensial di berkas lokal yang diabaikan Git. Akun SQL aplikasi hanya dapat membaca, menambah, dan memperbarui data pilot. Akun migrasi terpisah. Kedua koneksi memerlukan TLS. Jalur pilot di proxy Vite hanya tersedia lewat localhost.

## Cakupan pilot

1. Owner membuat katalog dan pemasok. Staf berizin memfinalisasi draft penerimaan. Persediaan bertambah satu kali, kuantitas kemasan dikonversi ke satuan dasar, dan biaya rata-rata diperbarui.
2. Staf bengkel membuat pelanggan, motor, dan WO. Estimasi menyimpan versi jasa dan barang. Perubahan estimasi meminta persetujuan ulang. Dua foto kondisi diunggah sebelum pengerjaan dan hanya dapat dibaca akun berizin.
3. Pengambilan barang yang dikonfirmasi mengurangi persediaan. Jika persediaan kurang, WO masuk **Menunggu Barang**. Staf mengulang pengecekan setelah barang tersedia. Pembatalan WO yang sudah berdampak pada persediaan memerlukan konfirmasi pengembalian dari owner.
4. Staf menandai servis **Siap Diambil**, memverifikasi pelunasan tunai atau transfer, lalu mencetak nota A4 atau menyimpan PDF lewat browser. Serah terima mengubah WO lunas menjadi **Selesai**.

Pilot memakai satu lokasi, kuantitas bulat dalam satuan dasar, dan harga Rupiah bulat. Sekali konfirmasi, sistem mengambil sisa barang pada versi estimasi yang disetujui. Staf mengonfirmasi pekerjaan dan kuantitas aktual sesuai versi terakhir sebelum menandai Siap Diambil. Selisih ditangani lewat revisi sebelum finalisasi. Histori kepemilikan lintas domain, diskon dan delegasi approval, impor stok, audit lengkap, QRIS/e-wallet, POS, showroom, serta koreksi/refund final masih bagian dari pekerjaan MVP. Pilot memerlukan UAT stakeholder dan persetujuan rilis sebelum penggunaan operasional.

## Kontrak API pilot

Semua URL memakai prefiks /pilot/api/. Kirim Accept: application/json. GET session memberikan token CSRF dan status login. Gunakan cookie sesi dan header X-CSRF-TOKEN untuk mutasi. POST session menerbitkan token baru.

| Area | Operasi |
|---|---|
| Sesi | GET/POST/DELETE session |
| Master | GET catalog · POST customers, vehicles, suppliers, items |
| Penerimaan | GET/POST receipts · POST receipts/{id}/finalize |
| WO | GET/POST work-orders · GET work-orders/{id} |
| Pengerjaan | POST work-orders/{id}/estimate, approval, photos, issue, finish, cancel |
| Nota dan serah terima | POST work-orders/{id}/pay, handover · GET work-orders/{id} memuat nota ketika lunas |

Pembuatan WO dan draft penerimaan menerima request_id UUID dari klien untuk percobaan ulang. Mutasi estimasi, keputusan pelanggan, pemakaian, penyelesaian, dan pembayaran memakai version untuk mencegah perubahan terhadap versi yang sudah kedaluwarsa. Status stok kurang dikembalikan sebagai Menunggu Barang beserta daftar barang.

## Verifikasi

Jalankan **python scripts/database/test_pilot.py** dari root. Uji membuat data sintetis di **garasi_hobby_pilot_test** dan menjalankan dua server HTTP lokal sementara untuk memeriksa sesi, akses role, foto privat, WAC, persaingan atas stok terakhir, reversal, pelunasan, dan serah terima. Frontend memakai npm test dan npm run build.
