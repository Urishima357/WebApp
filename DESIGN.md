# Garasi Hobby: bengkel, bukan template SaaS

Reading this as: aplikasi operasional bengkel dan showroom untuk tim Garasi Hobby, custom atelier sesuai proyek Stitch 16675435225937797520, ENERGY 2 / RHYTHM 2 / MOTION 3 pada transisi konteks dan foto, tanpa gerak dekoratif berulang.

## Arah yang dipertahankan

- Krem `#F6F3EC` sebagai meja kerja, charcoal `#292D2C` sebagai rangka, tembaga gelap `#914B2D` hanya untuk aksi utama. Sage dan merah hanya menyatakan status.
- Barlow Condensed mengingatkan tulisan papan bengkel; DM Sans membuat tabel dan formulir terbaca. Keduanya lokal, bukan font baru.
- Ringkasan mengikuti layar Stitch `6498508645f54b09b0c08a1104f6d39a` dan mobile `e24a40c9d8b243cc88d47badac96dd26`: panel pendapatan, pembayaran, servis penuh, lalu showroom dan stok. Bukan versi buku kerja tanpa panel dari revisi sebelumnya.
- Desktop punya header judul/tanggal/aksi satu tingkat, sidebar 220-248 px, body 14-16 px. Mobile memiliki kartu servis, bukan tabel desktop yang diperkecil. Ukuran 12 px hanya metadata.
- Panel 12 px mengelompokkan satu jenis keputusan; kontrol 8 px, badge 6 px. Ruang 24-32 px memisahkan modul, 12-16 px mengikat isi.
- Katalog motor mengikuti komposisi foto besar + nama + tahun/harga dari Stitch. Foto belum tersedia tetap placeholder berlabel, bukan motor fiktif.
- Dua garis tembaga dan huruf G menjadi emblem raster. Piktogram stensil mengacu pada penandaan peti perkakas; hanya dipakai untuk membantu pengenalan navigasi dan tindakan.
- SVG dilarang. Aset dibuat di Canva karena GPT Image 2.5 Sunburst gagal mengembalikan gambar. Ekspor PNG/WebP, tidak mengekspor vektor.
- Tema terang tetap: tabel, formulir, dan nota dipakai sepanjang hari di bengkel. Charcoal membatasi navigasi, bukan memaksa halaman gelap.
- Foto hanya referensi demo, bukan inventaris nyata. Angka berasal dari state demo dengan penanda yang terlihat.

## Motion yang punya pekerjaan

| Momen | Alasan | Perilaku |
|---|---|---|
| Navigasi | Menjaga konteks antarhalaman | CSS konten 360 ms, heading 300 ms, shell tetap; native View Transition hanya foto katalog/detail 420 ms agar menu operasional tidak menahan klik |
| Tab | Menunjukkan pilihan bergerak | Garis indikator bergeser 180 ms, keyboard langsung berpindah |
| Dialog | Memisahkan tugas sementara | Masuk 320 ms, keluar 180 ms; desktop scale kecil, mobile bottom sheet; backdrop berpasangan |
| Foto detail | Menghubungkan thumbnail dengan foto utama | Crossfade 180 ms, tidak menggeser formulir |
| Tombol dan kartu motor | Mengonfirmasi sentuhan | Tekan langsung; lepas 140 ms. Foto membesar sedikit saat hover/fokus |
| Transaksi sukses | Menegaskan hasil yang sudah tersimpan | Stempel centang 280 ms, tidak ada confetti atau klaim pembayaran dari animasi |

Kurva `cubic-bezier(0.22, 1, 0.36, 1)`. Tidak ada animasi baris tabel, parallax formulir, loop dekoratif, atau scroll reveal yang menyembunyikan data. Reduced motion menghilangkan perpindahan spasial. Tidak menambah dependency motion.
