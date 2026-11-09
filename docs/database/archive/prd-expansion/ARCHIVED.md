# Arsip — skema perluasan PRD yang dibatalkan

Skema ini sebelumnya dibuat dengan memperluas seluruh PRD. Pengguna mengoreksi bahwa database harus mengikuti ERD/LRS draw.io saja, dan memilih dua database terpisah (7 tabel servis + 5 tabel showroom).

File di folder ini dipertahankan sebagai histori, bukan instruksi deployment atau skema aktif. Jangan menjalankan script/SQL arsip ini. Database lama `garasi_hobby` dan backup privatnya tidak dihapus; phpMyAdmin dan koneksi backend aktif sekarang mengarah ke `garasi_hobby_servis` serta `garasi_hobby_showroom`.

Laporan 87 pemeriksaan lama berlaku untuk skema lama, bukan bukti pemeriksaan skema ERD baru. Hasil yang berlaku sekarang berada pada `docs/database/verification-results.json` dan `apps/api/database/erd/verification.json`.
