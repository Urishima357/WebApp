-- Minimal business vocabulary. No login accounts, gateway secrets or customer data.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
START TRANSACTION;
INSERT INTO roles(code,name) VALUES
('OWNER','Owner'),('WORKSHOP','Staf Bengkel'),('SHOWROOM','Staf Showroom'),('LIMITED_INPUT','Input Terbatas');
INSERT INTO permissions(code,description) VALUES
('dashboard.view_all','Ringkasan seluruh usaha'),
('cost.view','Harga modal dan estimasi profit'),
('user.manage','Kelola pengguna dan izin individual'),
('item.manage','Kelola master barang dan jasa'),
('item.manage_limited','Kelola field master barang terbatas'),
('goods_receipt.create','Buat penerimaan barang'),
('goods_receipt.finalize','Finalisasi penerimaan barang'),
('stock.adjust','Penyesuaian stok dengan alasan'),
('work_order.manage','Kelola work order'),
('service_tx.finalize','Finalisasi transaksi servis'),
('showroom.manage','Kelola inventaris showroom'),
('motor_sale.finalize','Finalisasi penjualan motor'),
('payment.confirm_manual','Konfirmasi pembayaran sesuai domain'),
('discount.approve','Approval diskon di atas batas'),
('refund.manage','Selesaikan refund manual'),
('stock.reverse','Reversal pemakaian barang'),
('estimate.override','Override estimasi dengan alasan'),
('reservation.override','Override reservasi dengan alasan'),
('staff_ops.manage','Kelola mekanik atau PIC'),
('transaction.cancel','Pembatalan dokumen final'),
('report.financial','Laporan keuangan sesuai scope'),
('audit.view','Baca dan filter audit'),
('settings.manage','Kelola konfigurasi usaha'),
('customer.manage','Kelola pelanggan'),
('vehicle.manage','Kelola identitas motor'),
('pos.manage','Penjualan barang sesuai domain');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='OWNER';
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE
(r.code='WORKSHOP' AND p.code IN ('work_order.manage','service_tx.finalize','payment.confirm_manual','stock.reverse','customer.manage','vehicle.manage','pos.manage')) OR
(r.code='SHOWROOM' AND p.code IN ('showroom.manage','payment.confirm_manual','customer.manage','vehicle.manage')) OR
(r.code='LIMITED_INPUT' AND p.code IN ('item.manage_limited','goods_receipt.create','goods_receipt.finalize'));
INSERT INTO discount_policies(role_id,transaction_type,max_discount_percent)
SELECT id,'SERVICE',0 FROM roles UNION ALL SELECT id,'POS',0 FROM roles UNION ALL SELECT id,'MOTOR',0 FROM roles;
INSERT INTO business_locations(code,name,address,is_default,is_active)
VALUES ('MAIN','Garasi Hobby','',1,1);
INSERT INTO business_settings(`key`,value,value_type) VALUES
('business_identity',JSON_OBJECT('name','Garasi Hobby','address','','contact','','receipt_note',''),'OBJECT'),
('currency',JSON_QUOTE('IDR'),'STRING'),
('timezone',JSON_QUOTE('Asia/Jakarta'),'STRING'),
('estimate_revision_amount',CAST('50000' AS JSON),'INTEGER'),
('estimate_revision_percent',CAST('10' AS JSON),'DECIMAL'),
('session_idle_minutes',CAST('30' AS JSON),'INTEGER'),
('cutover_at',CAST('null' AS JSON),'STRING'),
('features.kor_enabled',CAST('false' AS JSON),'BOOLEAN'),
('document_prefixes',JSON_OBJECT('WO','WO','SERVICE','SRV','POS','POS','MOTOR','MTR','GOODS_RECEIPT','GR','REFUND','RFD','ADJUSTMENT','ADJ','CORRECTION','KOR'),'OBJECT');
INSERT INTO payment_methods(code,name,mode,channel,is_active) VALUES
('CASH','Tunai','MANUAL','CASH',1),
('BANK_TRANSFER','Transfer Bank','MANUAL','BANK_TRANSFER',1),
('QRIS','QRIS','GATEWAY','QRIS',0),
('EWALLET','E-wallet','GATEWAY','EWALLET',0);
COMMIT;
