-- Generated strictly from ERD Garasi Hobby Priok.drawio / LRS Penjualan
-- No DROP, seed data, PRD extensions or migration journal.
-- String width and DECIMAL precision are physical choices; source LRS does not specify them.
-- Each child FK is mandatory. Non-key attributes are required in this initial translation.
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `garasi_hobby_showroom` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `garasi_hobby_showroom`;

CREATE TABLE `motor` (
  `id_motor` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_motor`),
  `kode_inventaris` VARCHAR(255) NOT NULL,
  `no_polisi` VARCHAR(255) NOT NULL,
  `merek` VARCHAR(255) NOT NULL,
  `tipe` VARCHAR(255) NOT NULL,
  `tahun` INT NOT NULL,
  `warna` VARCHAR(255) NOT NULL,
  `no_rangka` VARCHAR(255) NOT NULL,
  `no_mesin` VARCHAR(255) NOT NULL,
  `harga_jual` DECIMAL(18,2) NOT NULL,
  `status` VARCHAR(255) NOT NULL,
  UNIQUE KEY `uq_motor_kode_inventaris` (`kode_inventaris`),
  UNIQUE KEY `uq_motor_no_mesin` (`no_mesin`),
  UNIQUE KEY `uq_motor_no_polisi` (`no_polisi`),
  UNIQUE KEY `uq_motor_no_rangka` (`no_rangka`)
) ENGINE=InnoDB;

CREATE TABLE `pegawai` (
  `id_pegawai` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_pegawai`),
  `nama_pegawai` VARCHAR(255) NOT NULL,
  `jabatan` VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE `pembeli` (
  `id_pembeli` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_pembeli`),
  `nama` VARCHAR(255) NOT NULL,
  `kontak` VARCHAR(255) NOT NULL,
  `alamat` VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE `penjualan` (
  `id_penjualan` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_penjualan`),
  `id_pembeli` INT UNSIGNED NOT NULL,
  `id_motor` INT UNSIGNED NOT NULL,
  `id_pegawai` INT UNSIGNED NOT NULL,
  `tanggal_transaksi` DATETIME NOT NULL,
  `subtotal` DECIMAL(18,2) NOT NULL,
  `diskon` DECIMAL(18,2) NOT NULL,
  `alasan_diskon` VARCHAR(255) NOT NULL,
  `total` DECIMAL(18,2) NOT NULL,
  `status` VARCHAR(255) NOT NULL,
  UNIQUE KEY `uq_penjualan_id_motor` (`id_motor`),
  CONSTRAINT `fk_penjualan_id_pembeli` FOREIGN KEY (`id_pembeli`) REFERENCES `pembeli` (`id_pembeli`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_penjualan_id_motor` FOREIGN KEY (`id_motor`) REFERENCES `motor` (`id_motor`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_penjualan_id_pegawai` FOREIGN KEY (`id_pegawai`) REFERENCES `pegawai` (`id_pegawai`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `pembayaran` (
  `id_pembayaran` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_pembayaran`),
  `id_penjualan` INT UNSIGNED NOT NULL,
  `id_pegawai` INT UNSIGNED NOT NULL,
  `metode` VARCHAR(255) NOT NULL,
  `jumlah_diterima` DECIMAL(18,2) NOT NULL,
  `referensi` VARCHAR(255) NOT NULL,
  `tanggal_konfirmasi` DATETIME NOT NULL,
  UNIQUE KEY `uq_pembayaran_id_penjualan` (`id_penjualan`),
  CONSTRAINT `fk_pembayaran_id_penjualan` FOREIGN KEY (`id_penjualan`) REFERENCES `penjualan` (`id_penjualan`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_pembayaran_id_pegawai` FOREIGN KEY (`id_pegawai`) REFERENCES `pegawai` (`id_pegawai`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
