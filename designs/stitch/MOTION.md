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

## Implementasi frontend, 9 November 2026

Arah terbaru: [DESIGN.md](../../DESIGN.md), ENERGY 2 / RHYTHM 2 / MOTION 3 untuk pergantian konteks dan foto. SVG diganti aset raster Canva.

- Konten antarhalaman: CSS masuk 360 ms, judul 300 ms, shell tetap, tanpa menahan klik. Native View Transition dibatasi ke katalog/detail motor: foto memakai nama per motor, posisi/ukuran terhubung 420 ms. Native transition tidak dipakai untuk menu operasional karena pengambilan frame dapat menelan klik cepat. Browser tanpa API tetap mendapat animasi CSS.
- Garis tab bergerak 260 ms, indikator navigasi mobile 320 ms dengan transform. Fokus dan pemilihan keyboard tidak menunggu gerak.
- Native dialog: transisi permukaan/backdrop berpasangan, 320 ms masuk, 180 ms keluar. Mobile bottom sheet bergerak 48 px. Escape, batal, backdrop, tombol tutup melewati pemeriksaan perubahan belum disimpan yang sama. Fokus kembali ke pemicu.
- Drawer: 380 ms masuk, 220 ms keluar; background inert, fokus terjebak di navigasi, Escape mengembalikan fokus ke menu.
- Foto detail: crossfade dan scale 1.012 ke 1, 180 ms setelah pengguna memilih thumbnail. Animasi lama dibatalkan saat pilihan berubah cepat.
- Tombol: tekan langsung, pulih 180 ms. Foto kartu memperbesar maksimal 1.045, kartu terangkat 4 px pada pointer hover; fokus keyboard mendapat feedback. Tidak ada animasi baris tabel.
- Sukses: stempel centang raster 280 ms setelah status Paid tersimpan, bukan pengganti callback pembayaran.
- Reduced motion: navigasi dan foto langsung, transisi spasial dihilangkan, drawer tetap bisa dibuka. Tidak ada loop dekoratif atau dependency motion.

Tidak menambahkan reveal pada load/scroll: data operasional tidak disembunyikan untuk animasi. Uji browser berada di `apps/web/tests/browser-check.mjs`; hasil aktual dicatat terpisah, tidak disimpulkan dari keberadaan CSS.
