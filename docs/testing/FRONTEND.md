# Frontend — cakupan dan pemeriksaan

## Pemetaan desain Stitch

Proyek acuan: `16675435225937797520`, 33 artboard desktop dan 22 mobile pada `designs/stitch/README.md`. Artboard terkait digabung sebagai route, tab, atau dialog; tidak dibuat 55 HTML terpisah. DM Sans dan Barlow Condensed dimuat lokal dengan sans-serif fallback.

| Desain desktop | Frontend |
|---|---|
| 01–02 | Masuk role demo, `/ringkasan` |
| 03–08 | `/bengkel`, `/bengkel/baru`, `/bengkel/:id`; tab pekerjaan, estimasi/persetujuan, foto, riwayat; dialog pemakaian, reversal, pembatalan, handover |
| 09–12 | `/motor`, `/motor/baru`, `/motor/:id`, `/motor/:id/edit`; reservasi dan penjualan lewat dialog |
| 13–14 | `/pelanggan`, `/pelanggan/:id`; form pelanggan dan motor |
| 15–17 | `/stok`, `/stok/baru`, `/stok/:id`, `/stok/:id/edit`; kartu stok dan adjustment |
| 18–20 | `/supplier`, `/penerimaan`, `/penerimaan/baru`, `/penerimaan/:id`, `/kasir` |
| 21–25 | `/transaksi`, `/transaksi/:id`, `/pembayaran/:id`, `/nota/:id`; metode/state pembayaran dalam checkout |
| 26 | `/kontrol`; tab diskon, pembatalan/koreksi, refund |
| 27–29 | `/laporan`, `/audit`, `/notifikasi`; laporan transaksi, rekonsiliasi, stok, penerimaan, pemakaian |
| 30–32 | `/pengaturan`, `/pengaturan/pengguna`, `/pengaturan/master` |
| 33 | `/status` dan state kosong/validasi/offline pada halaman nyata |
| M01–M22 | Route sama, responsive 360 px ke atas, sidebar menjadi navigasi bawah 4 menu; halaman tugas/form/nota tidak memakai bottom navigation yang bersaing |

## Pemeriksaan yang tersedia

`cd apps/web; npm test` memakai Node `assert`, tanpa framework pengujian tambahan. **15 pemeriksaan lulus**, mencakup:

- Rekonsiliasi pendapatan seed tepat Rp34.850.000.
- Stock insufficient, tanpa mutasi state asal saat gagal.
- Persetujuan dan foto sebelum pengerjaan.
- Pemakaian stok sekali; finalisasi pembayaran tidak memotong ulang; finalisasi ganda ditolak.
- Handover memerlukan pembayaran lunas.
- Transfer tepat nominal; tunai cukup dan kembalian benar.
- Gateway Pending tidak lunas; staf tidak dapat menjalankan simulator; event duplikat ditolak.
- Motor terjual tetap memakai ID sama, berpindah ke pelanggan; penjualan kedua ditolak.
- Penerimaan draft tidak mengubah stok; 1 dus = 24 botol, WAC dan saldo dihitung saat final.
- Adjustment memerlukan izin dan alasan.
- Koreksi mengalihkan pembayaran; refund hanya selisih.
- Penomoran bulanan memakai Asia/Jakarta.
- Pembatalan menjaga pembayaran asli, membuat refund, dan mengembalikan efek stok sekali.
- Reversal barang menolak pengembalian ganda; status WO final tidak dapat diubah langsung.
- Pengajuan diskon menunggu owner, memblokir pembayaran sampai disetujui.

## Pemeriksaan browser

### Revisi visual 9 November 2026

Revisi kedua mengganti stylesheet, menyelaraskan ringkasan/sidebar/header dengan layar Stitch, mengganti daftar WO mobile menjadi kartu, menambahkan shared photo transition katalog/detail. Hasil terbaru: [UI-REVISION-02-2026-11-09.md](UI-REVISION-02-2026-11-09.md). Laporan revisi pertama di bawah adalah riwayat, bukan bukti kecocokan desain saat ini.

Source dan aset publik tanpa SVG, favicon/manifest memakai PNG. Aset dibuat melalui browser Canva (bukan MCP), sumber ada di `apps/web/public/ASSETS.md`. Pengujian baru: `npm test` (15 domain + UI statis), `npm run build`, `tests/browser-check.mjs`, `tests/contrast-check.mjs`. Chromium diuji pada 375/768/1024/1440 px. Hasil dan Delivery Gate terbaru: [UI-REVISION-2026-11-09.md](UI-REVISION-2026-11-09.md).

Kontras teks dihitung dari computed style dan warna latar di 17 route pada desktop/mobile; bukan klaim sertifikasi WCAG. Lighthouse/Web Vitals tidak diukur ulang pada revisi ini. Catatan di bawah merupakan pemeriksaan historis, bukan skor revisi terbaru.

Build TypeScript/Vite berhasil. Browser Chromium: smoke test 29 route pada viewport 390 px, semua memuat tanpa fatal error atau overflow horizontal halaman. Alur WO Dikerjakan → Siap Diambil → tagihan → tunai Rp350.000 untuk tagihan Rp330.000 → nota diuji pada browser. Pemeriksaan role Rina menyembunyikan showroom/owner tools dan menolak URL pengaturan. Screenshot dashboard desktop 1440 px, mobile 390 px, dan inventaris mobile diperiksa. Font computed body DM Sans; aset foto lokal memuat atau menampilkan placeholder yang jujur.

Pemeriksaan tambahan pada 360 px: 13 route inti tidak overflow horizontal. Audit Lighthouse pada dashboard menghasilkan Accessibility 100, Best Practices 100, SEO 100 setelah perbaikan kontras dan header tabel. Ini satu halaman, bukan sertifikasi seluruh aplikasi.

Belum UAT lengkap semua kombinasi role/status; belum uji perangkat fisik, screen reader, Lighthouse seluruh route, ketahanan storage penuh secara menyeluruh, ataupun integrasi API. CSS print A4 tersedia, pengujian printer fisik belum dilakukan.

## Batas cakupan

- Autentikasi, permission, audit, stok, pembayaran dan constraint di frontend **simulasi**, bukan keamanan atau integritas produksi.
- Form foto memakai canvas dan data URI lokal, bukan upload private storage. Tidak ada progress upload server nyata.
- Emblem raster terpasang pada aplikasi, nota, favicon/PWA. Upload logo melalui pengaturan belum diterapkan.
- Backend harus memvalidasi semua boundary, nomor unik, permission, stock movement, snapshot, ownership, pembayaran dan webhook secara atomik.
- Default diskon demo satu nilai staf, belum matriks backend per role dan jenis transaksi.
- Konfirmasi owner untuk override estimasi/reservasi belum alur terpisah; selesaikan persetujuan pelanggan atau reservasi terlebih dahulu dalam demo.
- Fitur P1/P2 tetap tidak menjadi MVP wajib: inquiry/follow-up, retur supplier, structured stock opname, profit lengkap, ekspor laporan, WhatsApp, installment/deposit, native mobile.

Hindari memasukkan data produksi. Ekspor JSON sebelum reset data contoh. Fixture QR bukan QRIS merchant dan tidak dapat dibayar.
