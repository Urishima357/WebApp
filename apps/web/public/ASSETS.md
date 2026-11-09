# Aset demo

Foto `images/w175.jpg`, `images/xsr.jpg`, `images/ninja.jpg`, dan `images/workshop.jpg` berasal dari URL aset pada desain Stitch proyek `16675435225937797520` milik pengguna. Foto contoh bukan dokumentasi inventaris atau kondisi motor pelanggan asli. Resolusi sumber terbatas (237-512 px), tidak diklaim sebagai foto produksi.

Font lokal DM Sans (variable Latin) dan Barlow Condensed 600 (Latin) diunduh dari Google Fonts. Keduanya berlisensi SIL Open Font License 1.1; lihat `fonts/DM-Sans-OFL.txt` dan `fonts/Barlow-OFL.txt`.

Sumber font: https://github.com/google/fonts/tree/main/ofl/dmsans dan https://github.com/google/fonts/tree/main/ofl/barlowcondensed.

## Aset raster, 9 November 2026

Pengguna menyetujui konsep dua garis tembaga + G dan piktogram stensil. GPT Image 2.5 Sunburst dicoba, tetapi provider mengembalikan `Codex did not return an image. Account may not be entitled`. Pengguna memilih Canva lewat browser sebagai pengganti. Tidak ada aset hasil Sunburst yang dipakai.

Logo, tiga lembar berisi masing-masing sembilan ikon, dan foto motor berselimut dibuat melalui Lab Imajinasi Canva, model `Canva Craft-1 2K`, kualitas Premium, akun Keqing Account. Operasi ini melalui browser, bukan MCP Canva. Generasi tersimpan di riwayat Lab Imajinasi, bukan desain presentasi baru. Tidak ada desain lama yang ditimpa.

- `brand/emblem.png`, `brand/icon-192.png`, `brand/icon-512.png`: varian kedua logo, dipotong dan diubah ukuran dari raster Canva.
- `icons/*.png`: 27 piktogram dari lembar 1 varian 4, lembar 2 varian 2, lembar 3 varian 3. Dipotong, latar putih diubah menjadi alpha, serpihan pinggir dihapus. Pewarnaan UI lewat CSS mask, bukan vektor. Rotasi memakai aset yang sama untuk kembali, turun, dan tutup.
- `images/motor-placeholder.webp`: varian kedua foto berselimut. Hanya placeholder, bukan data inventaris. Komponen mengumumkan foto belum tersedia melalui alt.

Tidak ada SVG di source, aset publik, favicon, atau manifest. Foto operasional yang diunggah pengguna tidak boleh ditempatkan di public pada implementasi produksi; gunakan private storage melalui backend.

Revisi visual kedua: Sunburst dicoba kembali untuk foto mood login, tetapi mengembalikan error entitlement yang sama. Tidak ada gambar baru yang dihasilkan atau dipakai. Login memakai foto referensi `images/workshop.jpg` yang telah tersedia; emblem/ikon raster Canva dipertahankan, bukan diklaim sebagai hasil Sunburst.
