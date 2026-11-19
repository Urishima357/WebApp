# Garasi Hobby — frontend

React + TypeScript + Vite. Implementasi responsif desain Stitch retro custom terbaru: krem, charcoal, tembaga; DM Sans untuk UI, Barlow Condensed untuk judul. Desktop dan mobile memakai aplikasi yang sama, bukan dua implementasi terpisah.

Revisi kedua 9 November 2026 mengikuti komposisi layar Stitch: header tunggal, panel ringkasan, servis desktop/tablet dan kartu servis mobile, katalog foto besar. Stylesheet lama diganti satu sistem dengan body 14-16 px. Tetap 27 piktogram raster Canva, emblem G, tanpa SVG. Arah dan alasan di [`../../DESIGN.md`](../../DESIGN.md); sumber aset di [`public/ASSETS.md`](public/ASSETS.md). View Transition menjaga foto katalog ke detail, indikator tab/navigasi bergerak, dialog dan drawer masuk/keluar berpasangan. Reduced motion tersedia, dependency runtime tetap.

## Jalankan

Butuh Node.js 22.12+ dan npm.

```powershell
cd apps/web
npm ci
npm run dev
```

Buka `http://127.0.0.1:5180/`. Dev dan preview memakai port tetap 5180, tidak berpindah otomatis bila port terpakai. Jalankan salah satunya saja. Pilih akun demo Pak Arif, Rina, Sari, atau Dani. Tidak ada kata sandi nyata.

```powershell
npm test
npm run build
npm run preview
```

`npm test` menjalankan aturan domain dan pemeriksaan UI statis. Browser check opsional memakai CDP browser uji terpisah (bukan profil utama), aplikasi di port 5180:

```powershell
node tests/browser-check.mjs <CDP-port>
node tests/contrast-check.mjs <CDP-port>
```

Pemeriksaan browser mengubah data demo di browser uji. Hasil JSON/screenshot disimpan ke `%LOCALAPPDATA%\Temp\opencode\garasi-ui-evidence`. Tidak mencakup perangkat fisik atau seluruh kombinasi role.

## Yang tersedia

- Shell desktop/sidebar dan mobile/bottom navigation sesuai role, login/logout demo dan idle timeout.
- Dashboard dari transaksi final, pencarian/filter, stok menipis, notifikasi.
- WO: penerimaan, foto, inspeksi, line jasa/barang, diskon, persetujuan pelanggan, pemakaian/reversal stok, status, pembayaran, serah terima, pembatalan.
- Showroom: daftar/grid, detail, form/foto, reservasi tanpa deposit, penjualan dan perpindahan identitas kepemilikan.
- Pelanggan dan motor terpadu, CRUD supplier, master barang/jasa/mekanik/kategori/satuan.
- Ledger stok, penyesuaian beralasan, penerimaan supplier draft/final dengan konversi satuan dan modal rata-rata.
- POS barang, transaksi, pembayaran tunai/transfer, state QRIS/e-wallet demo, nota A4 melalui native print/save PDF.
- Kontrol diskon, pembatalan final, koreksi KOR dengan pengalihan pembayaran, refund tercatat, laporan, rekonsiliasi, audit lokal.
- Pengaturan usaha/pembayaran/kebijakan, pengguna dan izin, cadangan JSON, reset dengan konfirmasi, contoh state kosong/loading/offline/error.
- Kompresi foto di browser, format JPEG/PNG/WebP maksimal 5 MB input, metadata disingkirkan melalui canvas. Data URI disimpan lokal; kapasitas browser terbatas.
- Manifest standalone, aset/font lokal, CSS micro-interactions, fokus keyboard, native dialog focus trap dan reduced motion. **Tidak ada offline transaction atau service worker caching.**

Halaman Stitch yang berdekatan digabung menjadi route/tab/dialog yang nyata dan saling terhubung. Daftar route serta pemetaan desain: `../../docs/testing/FRONTEND.md`.

## Pilot bengkel

Pilih **Buka pilot bengkel** di layar masuk untuk mencoba alur WO dan persediaan yang terhubung ke MySQL. [Panduan pilot](../api/README.md) menjelaskan cara menyalakan API dan membuat akun uji.

## Batas demo tampilan

**Ini frontend demo, bukan sistem operasional produksi. Jangan memasukkan data pribadi, kredensial, atau uang nyata.**

Tidak ada API, autentikasi/otorisasi server, hash password, server-side validation, private object storage, gateway/webhook, sinkronisasi tim, backup server, maupun deployment. Simulasi data tersimpan `localStorage` (`garasi-hobby-demo-v1`); sesi demo di `sessionStorage`. Akun, data finansial, dan audit lokal dapat dibaca/diubah melalui developer tools. Pembatasan role di UI **bukan batas keamanan**.

QRIS hanya ilustrasi tidak dapat dibayar. Tombol simulator gateway dibatasi owner demo dan tidak sama dengan verifikasi gateway nyata. Transfer/tunai adalah catatan simulasi, tidak memindahkan uang. Nota diberi label contoh. `window.print()` menyediakan pilihan Simpan PDF milik browser; aplikasi tidak mengunggah atau mengirim dokumen.

Validasi frontend menjaga alur demo, termasuk stok tidak negatif dan pembayaran tidak diproses dua kali. Seluruhnya harus diulang dengan transaksi database atomik dan permission API ketika Laravel diimplementasikan. Deteksi revisi antar-tab hanya perlindungan ringan; bukan concurrency multi-user yang aman. Dokumen demo dibuat memakai waktu Asia/Jakarta, bukan penomoran server.

Koreksi bertingkat tidak didukung; buat koreksi dari transaksi asal dan catat kebutuhan lanjutan pada backend. Supplier return, inquiry/CRM, profit formal, instalment/deposit, WhatsApp otomatis, akuntansi dan native mobile tidak ditambahkan.

## Struktur

`src/app/` shell, route hash dan penyimpanan demo; `src/features/` modul halaman; `src/components/` komponen/form; `src/lib/` tipe, state awal, aturan transaksi demo; `src/styles/global.css` token dan responsive CSS. Dependency runtime hanya React dan React DOM; routing hash, dialog, print, animasi memakai platform browser.
