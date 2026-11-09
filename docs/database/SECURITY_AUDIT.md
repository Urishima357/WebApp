# Audit keamanan database lokal

Pengujian dilakukan pada **8 November 2026** terhadap `garasi_hobby_servis` (7 tabel), `garasi_hobby_showroom` (5 tabel), dan phpMyAdmin lokal. Hasil akhirnya **535 pemeriksaan: 526 PASS, 0 FAIL, 8 WARN, 1 SKIP**. Enam temuan konfigurasi sudah diperbaiki; empat temuan masih terbuka. Status ini **belum merupakan persetujuan penggunaan produksi**.

Angka tersebut mencakup pemeriksaan berulang untuk setiap tabel/kolom, bukan 535 jenis eksploitasi yang berbeda. `WARN` berarti risiko atau keterbatasan benar-benar ditemukan, meskipun pengujiannya berjalan sesuai harapan. `SKIP` berarti hasil belum dapat disimpulkan. Nol `FAIL` tidak berarti semua risiko sudah selesai.

## Bukti dan cakupan

- [Laporan gabungan lengkap](security-report.json): setiap kasus, status, sumber laporan, checksum sumber, dan temuan.
- [Pengujian inti MySQL](security-audit.json): 370 PASS dan 5 WARN.
- [Pengujian berkas, phpMyAdmin, dan pemulihan](security-surfaces.json): 149 PASS, 3 WARN, dan 1 SKIP.
- [Regresi phpMyAdmin setelah perbaikan terakhir](security-surfaces-retest.json): 60 PASS. Laporan gabungan menggantikan hasil kasus yang sama dengan hasil regresi terakhir; kasus yang sama tidak dihitung ulang.

| Area | Pemeriksaan yang dijalankan |
|---|---|
| Server dan akun SQL | Bind loopback, TLS wajib, autentikasi SHA-2, akun anonim/remote, hak global, cakupan kedua database, batas koneksi, kebijakan penguncian akun. |
| Penolakan akses | Akun aplikasi, pembaca, backup, dan migrasi tidak dapat membaca tabel autentikasi MySQL atau database PRD lama. Akun pembaca/backup ditolak ketika mencoba INSERT, UPDATE, DELETE; akun aplikasi/pembaca/backup ditolak ketika mencoba ALTER. |
| TLS | Kelima akun menggunakan koneksi dengan verifikasi CA/identitas; koneksi tanpa TLS dan CA yang salah ditolak; TLS 1.2/1.3, SAN loopback, dan masa berlaku sertifikat diperiksa. Helper CLI aktif juga diuji. |
| Autentikasi dan kapasitas | Password salah, penguncian setelah ambang kegagalan, pembukaan kunci, batas koneksi bersamaan, serta pemulihan kapasitas memakai akun sekali pakai. Akun kerja tidak di-brute-force. |
| Integritas dan input | Duplikasi PK/UK, FK tanpa induk, NULL, penghapusan/perubahan induk yang masih dirujuk, string terlalu panjang, angka melampaui tipe, dan tanggal tidak valid. |
| Transaksi | Rollback eksplisit, rollback saat klien terputus setelah kesalahan, deadlock dua penulis, delapan pembayaran bersamaan, dan delapan penjualan motor yang sama. Masing-masing perlombaan menghasilkan satu keberhasilan dan tujuh penolakan duplikasi. |
| Akses berkas MySQL | LOCAL INFILE dan ekspor server dimatikan; hak FILE tidak tersedia. LOAD_FILE dan INTO OUTFILE diuji dengan penanda tidak rahasia pada lingkungan uji. |
| phpMyAdmin | Host/Origin asing, akses tanpa login, token salah/kedaluwarsa/array/pakai ulang, regenerasi ID sesi, atribut cookie, CSRF, header, traversal path, konfigurasi, encoding, dan alias path Windows/NTFS ADS. |
| Kredensial dan paket | ACL berkas sensitif, pengecualian Git, pencarian password yang diketahui dalam berkas proyek publik, checksum arsip, tanda tangan Oracle MySQL, dan kesamaan kode/binary terpasang terhadap arsip yang diverifikasi. |
| Backup dan restore | Backup kedua database dipulihkan ke target uji; seluruh isi dan DDL dibandingkan. Data contoh berisi dua rantai transaksi lengkap per database juga diekspor oleh akun backup dan dipulihkan, lalu dibandingkan per tabel. |

## Temuan yang diperbaiki

| ID | Tingkat | Hasil perbaikan |
|---|---|---|
| DBSEC-01 | Medium | Hak akses sisa ke database PRD lama dicabut dari akun aplikasi, backup, dan migrasi. Akun layanan dibatasi pada dua database ERD. |
| DBSEC-02 | Medium | Akun pembaca phpMyAdmin sekarang memiliki kebijakan lima kegagalan login, penguncian satu hari, TLS wajib, dan batas lima koneksi. |
| DBSEC-06 | Low | Path suffix, slash ganda, dan NTFS alternate data stream sekarang ditolak sebelum routing PHP/static. Sebelumnya alias ADS menampilkan sumber wrapper konfigurasi kecil yang berisi lokasi berkas privat; tidak ditemukan password SQL di respons tersebut. |
| DBSEC-07 | Low | Helper CLI sekarang menggunakan `VERIFY_IDENTITY` setelah sertifikat SAN terpasang; sebelumnya hanya memverifikasi CA. Mode awal inisialisasi tetap memerlukan CA sebelum sertifikat identitas dibuat. |
| DBSEC-09 | Medium | `SignonCookieParams` diatur eksplisit agar phpMyAdmin mempertahankan `HttpOnly` dan `SameSite=Strict` pada cookie sign-on. Pengaturan PHP awal saja ternyata ditimpa oleh default plugin sign-on. |
| DBSEC-10 | Low | Header `no-referrer` diterapkan setelah phpMyAdmin menyusun header, sehingga kebijakan lokal tidak tertimpa `same-origin`. |

Perbaikan disimpan pada script konfigurasi, bukan hanya diterapkan manual pada instance berjalan. Tidak ada tabel atau kolom bisnis yang ditambahkan.

## Empat temuan yang masih terbuka

**DBSEC-03 — Medium: nilai finansial belum divalidasi oleh skema.** Pada salinan uji, `total` servis negatif, `qty=0`, harga motor negatif, dan total penjualan yang berbeda dari subtotal/diskon diterima. Batas tipe numerik tidak memvalidasi aturan bisnis. Tetapkan aturan nominal/kuantitas yang disetujui, lalu terapkan validasi backend serta CHECK yang sesuai. Audit ini mempertahankan skema ERD pengguna dan tidak menambahkan aturan finansial secara diam-diam.

**DBSEC-04 — Medium: kredensial penulis yang bocor dapat melewati FK pada sesinya.** Akun aplikasi yang sah dapat mengatur `foreign_key_checks=0` lalu menulis referensi tanpa induk. Ini kemampuan sesi bawaan MySQL, bukan bypass autentikasi dari luar. Percobaan dilakukan pada salinan lalu di-rollback. Kredensial harus tetap di backend; gunakan parameter binding dan larang API SQL sembarang. Jika perlu membatasi penulis yang sudah terkompromi, desain hak tulis melalui operasi/prosedur terbatas perlu ditinjau tersendiri.

**DBSEC-05 — Medium: backup berada pada disk yang sama dan belum terenkripsi.** Restore berhasil, tetapi ACL tidak melindungi dari pencurian atau kerusakan disk. Sebelum menyimpan data pelanggan nyata, siapkan backup terenkripsi, kunci terpisah, salinan di perangkat/lokasi lain, jadwal, retensi, dan latihan restore.

**DBSEC-08 — Medium: partisipasi minimum detail/pembayaran belum dipaksakan.** Nota tanpa detail maupun pembayaran, serta penjualan yang pembayarannya dihapus, dapat terjadi. FK dan UNIQUE membatasi referensi serta maksimum kardinalitas; keduanya tidak memaksa keberadaan anak. Backend perlu membuat/menghapus transaksi secara atomik sesuai aturan ERD. Perubahan enforcement SQL berikutnya harus mempertahankan model 7 + 5 tabel dan aturan yang disepakati.

## Data yang dipertahankan dan batas kesimpulan

DDL dan checksum isi seluruh tabel aktif dibandingkan sebelum/sesudah tiap rangkaian uji, begitu pula checksum file draw.io. Semuanya tetap sama. Seluruh tabel aktif masih kosong saat audit; keberhasilan restore data berisi dibuktikan dengan fixture terpisah. Tidak ada database atau akun SQL sementara audit yang tertinggal. Salinan tambahan kredensial CLI yang dibuat audit dibersihkan. Frontend tidak diubah oleh pekerjaan audit ini.

Satu pemeriksaan inventaris listener Windows belum konklusif: lingkungan eksekusi tidak memberikan tampilan listener MySQL yang lengkap, termasuk ketika pembacaan dilakukan dari host. MySQL melaporkan `bind_address=127.0.0.1`, koneksi lokal 3307/8081 berhasil, dan konfigurasi phpMyAdmin mengikat loopback. Akses dari mesin lain belum diuji secara independen. Jangan mengubah binding ke jaringan publik tanpa pemeriksaan deployment berikutnya.

Backend Laravel/API belum terimplementasi. Karena itu, hasil ini tidak mencakup SQL injection melalui endpoint aplikasi, otorisasi role aplikasi, login pengguna, stored/reflected XSS seluruh aplikasi, payment gateway, maupun infrastruktur produksi. Tidak dilakukan serangan beban/DoS, eksploitasi binary, pemindaian jaringan luar, atau fuzzing menyeluruh. Tidak ada jaminan keamanan absolut.

## Versi dan rujukan primer

MySQL yang diuji adalah **8.4.13**, sesuai [release notes Oracle 20 Oktober 2026](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-13.html). PHP Windows **8.3.36-1** digunakan bersama phpMyAdmin **5.2.3**. Build PHP ini memuat perbaikan RCE pada 8.3.36 dan pembaruan Brotli pada build Windows `-1`; `session.upload_progress.enabled=0` juga diterapkan sesuai [advisory PHP Oktober 2026](https://www.php.net/archive/2026.php). Pemeriksaan versi/checksum tidak membuktikan ketiadaan seluruh CVE.

Advisory phpMyAdmin [PMASA-2025-1](https://www.phpmyadmin.net/security/PMASA-2025-1/), [PMASA-2025-2](https://www.phpmyadmin.net/security/PMASA-2025-2/), dan [PMASA-2025-3](https://www.phpmyadmin.net/security/PMASA-2025-3/) mencantumkan perbaikan pada 5.2.2 atau lebih baru. Daftar [advisory resmi](https://www.phpmyadmin.net/security/) diperiksa saat audit; eksploitasi setiap advisory tidak dijalankan.

## Menjalankan ulang

Dari folder `WebApp`, pastikan instance lokal MySQL dan phpMyAdmin sudah berjalan:

```powershell
python scripts/database/security_audit.py
python scripts/database/security_surfaces.py
python scripts/database/security_report.py
```

Script menggunakan runtime lokal yang sudah tersedia dan tidak mengunduh dependency. Diperlukan kredensial admin privat untuk membuat target/akun sementara. Penulisan hanya menuju salinan uji, sementara percobaan negatif baca-saja pada tabel aktif memakai kondisi tanpa baris. Jangan menjalankannya saat sedang melakukan migrasi atau perubahan data aktif karena verifikasi preservasi membutuhkan keadaan yang stabil.

Untuk regresi phpMyAdmin setelah perubahan router/cookie, gunakan `python scripts/database/security_surfaces.py --sections web --retest`, lalu buat ulang laporan gabungan. Laporan menggunakan regresi yang lebih baru daripada audit lengkap dan tetap menyertakan sumber serta checksum laporan asal. Exit code nol berarti pemeriksaan otomatis tidak gagal; temuan WARN/SKIP tetap harus dibaca sebelum keputusan produksi.
