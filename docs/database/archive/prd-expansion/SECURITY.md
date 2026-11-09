# Hasil Pengamanan Database Lokal

Tanggal: 8 November 2026. Cakupan: **instance development lokal**, bukan sertifikasi keamanan produksi.

## Hasil aktual

- MySQL Community 8.4.13 berjalan pada `127.0.0.1:3307`; database `garasi_hobby`.
- 42 tabel bisnis/pendukung dan satu tabel journal `schema_versions`; tiga migration SQL diterapkan dengan checksum.
- Paket resmi diperiksa dengan SHA-256 dan signature Oracle GPG; fingerprint penanda tangan dipin pada installer.
- **87 pemeriksaan lulus** pada MySQL asli. Detail: [verification-results.json](verification-results.json).
- Data pengujian ditempatkan pada schema sementara terpisah, lalu dibersihkan. Database utama tidak berisi akun login owner bawaan atau pelanggan uji.

## Kontrol yang sudah dibuktikan

| Area | Bukti pengujian |
|---|---|
| Transport | TLS aktif; koneksi tanpa TLS ditolak; client pengelola memverifikasi CA. |
| Akses | Akun aplikasi tidak dapat membaca mysql.user, membuat tabel/user, mengubah audit/menghapus ledger, atau menghapus pembayaran/refund. |
| Backup role | Tidak dapat menulis data dan tidak memiliki privilege TRIGGER/DDL. |
| Eksposur | Bind loopback, tidak ada akun anonymous/host remote; MySQL X Protocol tidak diaktifkan. |
| File I/O | local_infile=OFF dan secure_file_priv=NULL. |
| Integritas | InnoDB, FK, CHECK, unique identity, satu ownership aktif, dan opening stock tunggal ditegakkan. |
| Concurrency | Dua konsumsi stok sisa satu hanya menghasilkan satu commit; dua final penjualan motor hanya menghasilkan satu Final aktif. Ini uji constraint SQL, bukan keseluruhan proses penjualan aplikasi. |
| Histori | Ledger/audit immutable, snapshot/baris Final tidak dapat ditulis ulang, status Final tidak bisa diturunkan, satuan dasar terkunci setelah movement. |
| Pembayaran | Pembayaran sukses ganda dan event provider duplikat ditolak; event bertanda signature tidak valid tidak dapat mengklaim kunci deduplikasi. Verifikasi signature kriptografis payload gateway tetap tanggung jawab adapter backend yang belum dibuat. |
| Pemulihan | Backup database utama direstore pada schema terpisah; seluruh data tabel dan definisi trigger dibandingkan dan cocok. |
| Restart | Stop/start instance lokal diuji, versi/config dan data directory tetap sesuai. |
| Rahasia | Kredensial disimpan pada file privat dengan ACL terbatas dan diabaikan Git; password tidak dicetak atau dimasukkan dalam argumen proses. |

## Batas jaminan

Tidak ada jaminan keamanan 100%. Kontrol ini mengurangi risiko dan dapat diuji ulang, tetapi belum mengaudit backend/frontend, OS, jaringan produksi, atau integrasi gateway. Akun administrator OS/SQL tetap memiliki kemampuan mengubah sistem; trigger bukan perlindungan terhadap DBA yang menghapusnya.

Aturan lintas tabel seperti pembayaran penuh sebelum finalisasi, jumlah foto, cakupan role pengguna aplikasi, agregat refund, WAC/reversal, dan interval ownership tertutup tetap memerlukan action Laravel yang memakai parameter binding, authorization, row lock, dan audit. Database kosong yang berhasil dibuat bukan bukti semua UAT bisnis sudah lulus.

Backup sekarang disimpan lokal dengan kontrol akses; belum ada enkripsi backup, salinan off-device, atau jadwal harian. Hal itu, pemantauan/rotasi secret, serta verifikasi patch/advisory harus diselesaikan sebelum produksi. KOR dan gateway masih tidak aktif. Jangan mengirim kredensial database ke frontend atau mengubah host akun menjadi `%`.

Panduan operasi dan setup: [infra/mysql/README.md](../../infra/mysql/README.md).
