-- Generated strictly from ERD Garasi Hobby Priok.drawio / LRS Servis
-- No DROP, seed data, PRD extensions or migration journal.
-- String width and DECIMAL precision are physical choices; source LRS does not specify them.
-- Each child FK is mandatory. Non-key attributes are required in this initial translation.
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `garasi_hobby_servis` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `garasi_hobby_servis`;

CREATE TABLE `mekanik` (
  `id_mekanik` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_mekanik`),
  `nama_mekanik` VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE `pegawai` (
  `id_pegawai` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_pegawai`),
  `nama_pegawai` VARCHAR(255) NOT NULL,
  `jabatan` VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE `pelanggan` (
  `id_pelanggan` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_pelanggan`),
  `nama` VARCHAR(255) NOT NULL,
  `kontak` VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE `kendaraan` (
  `id_kendaraan` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_kendaraan`),
  `id_pelanggan` INT UNSIGNED NOT NULL,
  `no_polisi` VARCHAR(255) NOT NULL,
  `merek` VARCHAR(255) NOT NULL,
  `tipe` VARCHAR(255) NOT NULL,
  `tahun` INT NOT NULL,
  `warna` VARCHAR(255) NOT NULL,
  UNIQUE KEY `uq_kendaraan_no_polisi` (`no_polisi`),
  CONSTRAINT `fk_kendaraan_id_pelanggan` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan` (`id_pelanggan`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `nota_servis` (
  `id_nota` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_nota`),
  `id_kendaraan` INT UNSIGNED NOT NULL,
  `id_mekanik` INT UNSIGNED NOT NULL,
  `id_pegawai` INT UNSIGNED NOT NULL,
  `no_work_order` VARCHAR(255) NOT NULL,
  `tanggal` DATETIME NOT NULL,
  `odometer` INT NOT NULL,
  `keluhan` VARCHAR(255) NOT NULL,
  `subtotal` DECIMAL(18,2) NOT NULL,
  `diskon` DECIMAL(18,2) NOT NULL,
  `total` DECIMAL(18,2) NOT NULL,
  CONSTRAINT `fk_nota_servis_id_kendaraan` FOREIGN KEY (`id_kendaraan`) REFERENCES `kendaraan` (`id_kendaraan`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_nota_servis_id_mekanik` FOREIGN KEY (`id_mekanik`) REFERENCES `mekanik` (`id_mekanik`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_nota_servis_id_pegawai` FOREIGN KEY (`id_pegawai`) REFERENCES `pegawai` (`id_pegawai`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `detail_servis` (
  `id_detail` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_detail`),
  `id_nota` INT UNSIGNED NOT NULL,
  `jenis` VARCHAR(255) NOT NULL,
  `uraian` VARCHAR(255) NOT NULL,
  `qty` DECIMAL(18,2) NOT NULL,
  `harga` DECIMAL(18,2) NOT NULL,
  `diskon` DECIMAL(18,2) NOT NULL,
  `jumlah` DECIMAL(18,2) NOT NULL,
  CONSTRAINT `fk_detail_servis_id_nota` FOREIGN KEY (`id_nota`) REFERENCES `nota_servis` (`id_nota`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `pembayaran` (
  `id_pembayaran` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_pembayaran`),
  `id_nota` INT UNSIGNED NOT NULL,
  `metode` VARCHAR(255) NOT NULL,
  `diterima` DECIMAL(18,2) NOT NULL,
  `kembalian` DECIMAL(18,2) NOT NULL,
  `tanggal_konfirmasi` DATETIME NOT NULL,
  UNIQUE KEY `uq_pembayaran_id_nota` (`id_nota`),
  CONSTRAINT `fk_pembayaran_id_nota` FOREIGN KEY (`id_nota`) REFERENCES `nota_servis` (`id_nota`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
