# BPMN servis Garasi Hobby TO-BE

[Diagram usulan 19 November 2026](servis-to-be.bpmn) menyelaraskan alur servis dengan [PRD v1.2](<../../Product Requirements Document (PRD) v1.2.md>). Diagram awal dan [audit BPMN](../../../Audit_BPMN_Garasi_Hobby_Priok.md) menjadi referensi desain. Status penerapan mengikuti [keputusan skema dan ruang lingkup rilis](../../docs/decisions/2026-11-19-skema-dan-ruang-lingkup-rilis.md).

Diagram dapat dibuka di pemodel BPMN 2.0. Pool bengkel memuat lane staf/kasir, mekanik, dan sistem agar urutan antara tugas manusia dan aplikasi tersambung. Staf menyampaikan estimasi, mencatat keputusan pelanggan, dan mencatat serah terima motor. Konfirmasi provider pembayaran digambarkan pada langkah verifikasi sistem. Diagram bersifat deskriptif untuk review proses dan penyusunan UAT.

## Skenario review

| Skenario | Hasil yang harus terlihat | Acuan PRD v1.2 |
|---|---|---|
| Pelanggan menyetujui estimasi dan foto lengkap | Staf mencatat persetujuan. WO hanya masuk pengerjaan setelah syarat foto terpenuhi dan stok diperiksa. | WKS-03, WKS-06–09, UAT-03, UAT-14 |
| Pelanggan menolak sebelum pemakaian | Staf dapat merevisi estimasi atau membatalkan WO dengan alasan. Pembatalan sebelum ada pemakaian tidak mengubah stok. | BR-WKS-05, WKS-14 |
| Stok kurang, termasuk saat dikonfirmasi oleh dua staf | WO masuk Menunggu Barang. Jika barang masuk, stok dicek ulang sebelum pekerjaan berlanjut. Penerimaan draft tidak menambah stok, dan pemakaian yang ditolak tidak mengurangi stok. | WKS-08, WKS-12, PUR-04–05, UAT-05, UAT-26 |
| Lingkup pekerjaan berubah di atas ambang | WO kembali Menunggu Persetujuan. Pekerjaan dan finalisasi menunggu keputusan atas versi estimasi yang baru. | WKS-06, WKS-10, BR-WKS-08, UAT-15 |
| WO dibatalkan setelah barang dikeluarkan | Pembatalan menunggu rekonsiliasi yang sah dan mencatat alasannya. | WKS-14, BR-WKS-09, UAT-28 |
| Pembayaran belum terverifikasi atau konfirmasi diulang | Pending, Failed, Expired, atau nominal kurang tidak dapat menutup transaksi. Finalisasi lunas menghasilkan satu transaksi dan satu nota, tanpa pengurangan stok kedua. | WKS-12–13, PAY-01, PAY-05, PAY-10, UAT-04, UAT-16–17, UAT-22 |
| Pelanggan menerima motor | Staf menyerahkan nota dan mencatat penyerahan motor. WO menjadi Selesai sesudah transaksi final dan penyerahan tercatat. | BR-WKS-04 |

Alur ini mencakup proses target PRD, termasuk verifikasi gateway. Cakupan tahap pertama yang diajukan memakai tunai dan transfer manual. Koreksi dan refund setelah finalisasi mengikuti proses terpisah (WKS-15). Biaya WO yang dibatalkan di tengah pengerjaan tetap mengikuti keputusan terbuka OQ-14.
