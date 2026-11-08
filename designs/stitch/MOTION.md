# Motion — Garasi Hobby Retro Custom

Tujuan: ekspresif pada foto motor; cepat dan tenang pada pekerjaan operasional.

| Interaksi | Durasi | Perilaku |
|---|---|---|
| Tekan tombol | 120–160 ms | Skala 0.98; pulih saat dilepas |
| Hover foto motor | 180 ms | Skala foto maksimal 1.025, dalam bingkai |
| Pergantian tab | 220 ms | Indikator bergeser; fokus tetap jelas |
| Drawer / bottom sheet | 280 ms masuk, 180 ms keluar | Translasi 16 px + opacity; fokus masuk panel, kembali ke pemicu saat ditutup |
| Foto utama pertama tampil | 480 ms, satu kali | Reveal crop; bukan setiap baris tabel ikut bergerak |
| Pembayaran berhasil | 300 ms | Checkmark setelah status Paid terverifikasi; bukan sebelum callback |

Kurva utama: `cubic-bezier(0.22, 1, 0.36, 1)`. Tidak ada roda berputar terus-menerus, parallax formulir, shake seluruh layar, confetti finansial atau animasi yang menunda tombol.

## Aksesibilitas dan keandalan

- `prefers-reduced-motion: reduce`: hilangkan translasi, scale, reveal dan smooth scrolling; tampilkan status langsung.
- Skeleton statis pada reduced motion; bukan area kosong tanpa penjelasan.
- Tetap sediakan label status; warna dan gerak bukan satu-satunya penanda.
- Modal mengunci fokus, mendukung Escape bila aman, mempertahankan data formulir.
- Tombol kirim menolak klik ganda selama request; animasi selesai bukan bukti transaksi berhasil.
- Retry pembayaran menunggu status terakhir jelas; pending tidak menjadi Paid karena timeout animasi.

Ini spesifikasi implementasi. Keberadaan transisi pada HTML Stitch tidak membuktikan seluruh animasi dan navigasi sudah bekerja atau diuji.
