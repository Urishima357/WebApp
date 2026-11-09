# Garasi Hobby: revisi visual 9 November 2026

Scope: aset, shell, ringkasan, komponen bersama, keterbacaan, motion desktop/mobile. Aturan global tanpa SVG tersimpan di `C:\Users\USER\.config\opencode\AGENTS.md`. Mode antislop DURING dipilih pengguna, tidak disimpan sebagai default.

## Hasil

- 27 piktogram stensil PNG, emblem dua garis tembaga + G, ikon PWA 192/512, placeholder WebP dari Canva Lab Imajinasi. Browser Canva, bukan MCP. GPT Image 2.5 Sunburst gagal di provider, tidak diklaim digunakan.
- Ringkasan berupa buku kerja, bukan kumpulan kartu seragam: pendapatan terbuka, antrean servis, stok, inventaris showroom. Titik dekoratif, ikon pengisi, panah berulang, blur navbar dihapus.
- Native View Transition 180 ms, tab 180 ms, dialog 240/160 ms, drawer 280/180 ms, thumbnail 180 ms. Reduced motion langsung, tanpa loop. Tidak menambah dependency.
- Foto sumber lama tetap terbatas resolusinya. Bukan dokumentasi inventaris nyata. Tidak menggantinya dengan foto motor fiktif yang terlihat seperti data nyata.

## Pemeriksaan

- `npm test`: 15 aturan domain + pemeriksaan UI statis lulus.
- `npm run build`: TypeScript/Vite lulus.
- `node tests/browser-check.mjs <CDP-port>`: 86 pemeriksaan Chromium lulus, termasuk 12 route pada 375/768/1024/1440 px, tanpa overflow horizontal halaman, SVG, gambar gagal, kontrol tanpa nama, atau cursor kontrol yang salah.
- `node tests/contrast-check.mjs <CDP-port> 1440` dan `375`: 17 route masing-masing, tidak ada kegagalan teks pada computed color/background yang diperiksa. Teks foto login memakai scrim gelap; gambar bukan termasuk kalkulasi latar solid. Bukan sertifikasi WCAG seluruh aplikasi.
- Evidence mentah dan screenshot: `%LOCALAPPDATA%\Temp\opencode\garasi-ui-evidence\checks.json`, `contrast.json`, `desktop.png`, `mobile.png`.
- Browser uji terpisah digunakan untuk mutasi data. Tidak mengubah data demo pada browser utama pengguna. Tidak ada desain Canva lama ditimpa; koneksi ke Chrome utama telah diputus.

## Catatan klik, per elemen

| Elemen | Hasil yang diamati |
|---|---|
| Masuk demo | Akun Owner membuka ringkasan (uji manual agent-browser) |
| Ringkasan, Bengkel, Motor, Stok, Transaksi, Pelanggan, Supplier, Barang masuk, Laporan, Persetujuan, Audit aktivitas, Pengaturan | Masing-masing diklik pada empat lebar, membuka halaman dengan satu h1, tanpa error layout |
| Pending, Gagal, Kedaluwarsa | Membuka laporan dengan query status yang sesuai |
| Refund | Membuka persetujuan |
| Inspeksi, Menunggu Persetujuan, Menunggu Barang, Dikerjakan, Siap Diambil | Membuka bengkel dengan query status |
| Tersedia, Reserved, Terjual | Membuka inventaris dengan query status |
| Buat WO | Membuka formulir terima motor |
| Semua WO | Membuka daftar bengkel |
| Baris motor aktif | Membuka detail WO |
| Buka stok | Membuka daftar stok |
| Baris stok menipis | Membuka detail barang |
| Foto showroom | Membuka inventaris |
| Periode pendapatan | Select dapat dioperasikan keyboard, label periode terbaca |
| Notifikasi | Membuka peringatan stok |
| Tampilan daftar/kartu motor | Tabel/kartu berganti |
| Tab Diarsipkan | Empty state dengan saran ubah pencarian/tambah motor |
| ArrowRight tab | Pilihan dan fokus berpindah bersama |
| Pencarian motor | Tidak cocok menampilkan empty state; tombol hapus mengembalikan daftar |
| Thumbnail Depan/Kanan/Kiri | Foto dan aria-pressed berganti; animasi lama dibatalkan |
| Reservasi tanpa pelanggan | Validasi native menahan submit (uji manual agent-browser) |
| Tambah pelanggan, kosong | Validasi required muncul |
| Tambah pelanggan, data contoh | Baris tersimpan, dialog tertutup, pesan sukses muncul |
| Dialog diubah lalu Escape | Confirm perubahan belum disimpan muncul; dismiss mempertahankan dialog (uji manual agent-browser) |
| Menu mobile | Drawer masuk; background inert; Shift+Tab melingkar ke akun |
| Escape drawer | Tutup, fokus kembali ke tombol menu |
| Akun demo | Bottom sheet terbuka; Escape menutup, fokus kembali ke avatar |
| Reduced motion | Drawer tetap dapat dibuka, tanpa animasi aktif |
| Kosong/Memuat/Offline/Akses/Validasi | Masing-masing state sistem tampil setelah diklik |
| Console | Tidak ada Runtime.exceptionThrown dalam run browser akhir |

## Delivery Gate

### Hard Gate

- R-02 PASS: scan source TS/TSX/CSS/HTML/manifest tidak mengandung em dash.
- R-03 PASS: 48 pemeriksaan layout pada empat lebar, tidak ada overflow halaman; tombol mobile yang diedit minimal 44 px.
- R-17 PASS: angka ringkasan berasal dari state, label data demo terlihat.
- R-18 PASS: tidak membuat testimoni atau identitas pelanggan nyata.
- R-23 PASS: konsep logo/ikon disetujui; pengguna memilih Canva ketika Sunburst gagal.
- R-24 PASS: 12 navigasi utama dan tautan ringkasan membuka tujuan nyata, tercatat di atas.
- R-25 PASS: computed contrast 17 route desktop/mobile tanpa kegagalan; foto login diberi scrim untuk teks, bukan white-on-photo tanpa perlindungan.
- R-26 PASS: kontrol yang dibangun/diubah memiliki perilaku; 86 pemeriksaan dan daftar klik di atas. Logika bisnis modul lain tidak ditulis ulang.
- R-27 PASS: empty state nyata, error storage/offline/validasi dipertahankan, teks loading bootstrap tersedia, lima contoh state sistem diklik.
- R-28 PASS: tidak menambahkan FAQ.
- R-32 PASS: tab ArrowRight, drawer trap, Escape, pemulihan fokus diuji; native dialog tetap mengunci fokus.
- R-33 PASS: source diedit langsung dengan patch. Skrip temp hanya memotong raster, tidak menulis ulang CSS/source.
- R-34 PASS: satu tema terang yang memang ditetapkan untuk aplikasi bengkel; tidak mengirim toggle tema setengah jadi.
- R-35 PASS: build, unit check, run Chromium, screenshot desktop/mobile, dan daftar klik tersedia.
- R-36 PASS: tidak membuat klaim keamanan, kecepatan, pelanggan, atau skor performa.
- R-37 PASS: arah retro-custom dari referensi pengguna, Design Read dan dials dicatat sebelum frontend diubah.
- R-38 PASS: label demo/placeholder nyata; foto berselimut ditandai foto belum tersedia, bukan foto produk palsu.
- R-39 PASS: kontrol native, nama aksesibel, pointer, focus, hover/active, alt, label, reduced motion diperiksa; halaman login main/footer, judul halaman dinamis.
- R-40 PASS: img diberi dimensi; foto prioritas eager/high, font lokal preload, tidak ada script pihak ketiga render-blocking. Lighthouse/Web Vitals tidak diukur.

### Purpose-Gate

- R-01 PASS: krem untuk kanvas kerja, charcoal untuk rangka navigasi, tembaga untuk aksi utama; alasan di `DESIGN.md`.
- R-04 PASS: stensil merepresentasikan label peti bengkel; ikon navigasi membantu pemindaian, ikon pengisi dihapus.
- R-06 PASS: Barlow Condensed mengikuti papan bengkel; DM Sans mempertahankan pembacaan data/formulir.
- R-07 PASS: tidak menambahkan grid/pola latar dekoratif.
- R-08 PASS: panah berulang di link dihapus, chevron menandai buka detail, kembali mengarah ke konteks sebelumnya.
- R-09 PASS: badge hanya status data demo, bukan slogan AI atau label duplikat di atas h1.
- R-10 PASS: blur di navbar, bottom nav, backdrop dihapus.
- R-12 PASS: shadow hanya overlay dialog/toast, bukan setiap komponen.
- R-13 PASS: tidak ada glow dekoratif.
- R-14 PASS: katalog motor seragam karena objek setara; hierarki ringkasan dibedakan, bukan kartu fitur generik.
- R-19 PASS: motion untuk orientasi/feedback, durasi dicatat, tanpa loop/animasi baris tabel.
- R-22 PASS: tidak membuat ilustrasi generik. Foto berselimut mengkomunikasikan data foto yang belum tersedia.

### Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 2 / MOTION 2 dinyatakan di `DESIGN.md`.
- Konsistensi PASS: pendapatan terbuka, daftar kerja, strip foto memberi variasi terukur, bukan semua panel sama.
- Focal point PASS: pendapatan pada ringkasan, pekerjaan pada daftar, foto pada detail showroom.
- Whitespace PASS: jeda memisahkan jenis pekerjaan, jarak rapat mengikat data satu baris.
- Accent PASS: tembaga terbatas aksi utama, fokus/status aktif.
- Motif PASS: emblem dua garis + G, tulisan condensed, piktogram stensil diulang dengan fungsi.
- Design Read PASS: dicatat sebelum implementasi frontend.

### Craftsmanship & Quality Locks

- C-1 PASS: alasan warna, font, layout, ikon, spacing, motion tertulis di `DESIGN.md`.
- C-2 PASS: kontrol yang diedit diklik; tidak menambah kontrol mati.
- C-3 PASS: ringkasan mengikuti keputusan operasional, tanpa grafik atau testimoni pengisi.
- C-4 PASS: empat lebar, empty/error/loading, keyboard, reduced motion tercakup; batas uji di bawah tetap berlaku.
- C-5 PASS: demo dan foto referensi dilabeli, tidak diklaim sebagai usaha/data produksi.
- R-05 PASS: buku kerja + stok + strip inventaris, bukan hero/fitur/bento.
- R-11 PASS: tombol 4 px, panel 5-10 px, avatar lingkaran; bukan semua pill.
- R-15 PASS: CTA spesifik seperti Terima motor, Tambah motor, Simpan pengaturan.
- R-16 PASS: tidak menambahkan buzzword pemasaran AI.
- R-20 PASS: identitas bengkel lewat tipografi papan, stensil, foto custom, struktur WO/stok.
- R-21 PASS: terang untuk membaca formulir/nota pada lingkungan bengkel; charcoal hanya navigasi.
- R-29 PASS: krem/charcoal/tembaga; sage/merah hanya status, bukan palet dekoratif baru.
- R-30 PASS: tidak meniru produk SaaS populer.
- R-31 PASS: keputusan mayor punya alasan satu baris di `DESIGN.md`.

## Batas yang tidak diklaim selesai

Bukan UAT seluruh kombinasi role/status, bukan uji perangkat fisik/screen reader, bukan sertifikasi WCAG, bukan audit penuh seluruh transaksi. Tidak mengimplementasikan API/backend/payment gateway. Foto sumber masih resolusi demo. Tidak ada angka Lighthouse/Core Web Vitals revisi ini.
