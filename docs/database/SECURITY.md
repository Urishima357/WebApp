# Keamanan Database ERD Lokal

Database aktif: garasi_hobby_servis (7 tabel) dan garasi_hobby_showroom (5 tabel). Skema tidak ditambah tabel keamanan aplikasi di luar ERD; akun SQL dikelola pada sistem MySQL.

Audit lokal 8 November 2026 menghasilkan **535 pemeriksaan: 526 PASS, 0 FAIL, 8 WARN, 1 SKIP**. Enam masalah konfigurasi sudah diperbaiki; empat temuan masih terbuka. Lihat [laporan audit dan tindak lanjut](SECURITY_AUDIT.md) serta [bukti lengkap JSON](security-report.json). Hasil ini belum merupakan persetujuan produksi.

- MySQL 8.4.13 bind 127.0.0.1:3307, TLS wajib, CA dan identitas localhost/127.0.0.1 diverifikasi.
- gh_app hanya SELECT/INSERT/UPDATE/DELETE pada database aplikasi; tanpa CREATE/DROP/ALTER/FILE/CREATE USER.
- gh_viewer untuk phpMyAdmin hanya SELECT/SHOW VIEW pada dua database ERD; akses skema lama dicabut dari seluruh akun layanan.
- gh_backup hanya membaca data; gh_migrate terpisah untuk perubahan struktur.
- Password acak berada pada file privat dengan ACL terbatas; tidak ditanam di SQL, frontend, atau Git.
- Foreign key, primary key, unique key dan maksimum kardinalitas sesuai LRS diuji. Hasil aktif: [verification-results.json](verification-results.json).
- Backup kedua database berada di .local/mysql/backups; belum terenkripsi atau off-device. File ERD dan frontend tidak diubah.
- phpMyAdmin menggunakan sign-on sekali pakai, cookie HttpOnly/SameSite Strict, validasi Host/Origin, serta penolakan path konfigurasi dan alias path Windows.

Tidak ada jaminan keamanan mutlak. Pengamanan login/permission aplikasi, validasi input, transaksi bisnis dan minimum jumlah detail/pembayaran tetap perlu ditangani backend. Trigger dan laporan 87 pengujian pada model PRD lama tidak diklaim berlaku pada skema ERD ini.
