# MySQL Garasi Hobby ? ERD aktif

MySQL Community 8.4.13, 127.0.0.1:3307, TLS wajib. Terpisah dari XAMPP. Database aktif sesuai pilihan pengguna:

- garasi_hobby_servis ? tepat 7 tabel.
- garasi_hobby_showroom ? tepat 5 tabel.

Nama tabel, kolom, PK, FK dan UK mengikuti LRS di draw.io. Tidak ada journal migration atau tabel tambahan dalam kedua database. Model PRD 43 tabel sebelumnya diarsipkan dan tidak menjadi target perintah migrate.

Jalankan dari akar WebApp:

```powershell
python scripts/database/manage.py start
python scripts/database/manage.py status
python scripts/database/erd_databases.py apply
python scripts/database/verify.py
python scripts/database/manage.py backup
python scripts/database/phpmyadmin.py open
python scripts/database/manage.py stop
```

Setup mesin baru memakai install_runtime.py lalu manage.py setup sebelum apply. Apply menolak menimpa struktur berbeda dan tidak menghapus data aktif. phpMyAdmin memerlukan PHP dan phpMyAdmin portable terverifikasi yang disiapkan pada .tools; XAMPP lama tidak digunakan.

Koneksi backend privat: apps/api/.env.database.local, DB_DATABASE=garasi_hobby_servis dan DB_SHOWROOM_DATABASE=garasi_hobby_showroom. Frontend tidak menerima password SQL. Akun runtime gh_app terpisah dari admin dan migrasi; gh_viewer hanya membaca untuk phpMyAdmin. SQL accounts memerlukan TLS; local_infile OFF dan secure_file_priv NULL. File .local/.tools/.env diabaikan Git dan kredensial dibatasi ACL.

Backup memakai akun readonly, disimpan privat di .local/mysql/backups, belum dienkripsi/off-device. Skema baru tidak memiliki trigger; backup menolak trigger tambahan yang belum direview. Tidak memasang service Windows, mengubah firewall, atau mendaftarkan backup terjadwal.

[Dokumentasi database aktif](../../docs/database/README.md). Skema lama garasi_hobby dan backupnya tidak dihapus; viewer phpMyAdmin hanya memiliki akses ke dua database ERD.
