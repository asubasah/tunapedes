-- ============================================================
-- FITMOTOR CRM — Migration V3
-- Fitur: Periodic Maintenance Follow-up (H+1, H+30, H+90, H+180)
-- Target: VPS Produksi 103.174.114.249
-- Instruksi: mysql -u dongkrak_user -p fitmotor_crm < migration_v3.sql
-- AMAN: Tidak truncate data. ALTER bersifat additive.
-- ============================================================

USE fitmotor_crm;

-- ── STEP 1: Fix ENUM booking.status ──────────────────────────
-- Sinkronisasi schema dengan kondisi VPS produksi setelah fix_enum.js
ALTER TABLE booking
  MODIFY status ENUM('pending','proses','selesai','batal','confirmed')
  NOT NULL DEFAULT 'pending';

SELECT 'Step 1 OK: booking.status ENUM updated' AS status;

-- ── STEP 2: Tambah kolom tracking reminder ke riwayat_servis ─
ALTER TABLE riwayat_servis
  ADD COLUMN IF NOT EXISTS reminder_h1_sent   TINYINT(1) NOT NULL DEFAULT 0 AFTER catatan,
  ADD COLUMN IF NOT EXISTS reminder_h30_sent  TINYINT(1) NOT NULL DEFAULT 0 AFTER reminder_h1_sent,
  ADD COLUMN IF NOT EXISTS reminder_h90_sent  TINYINT(1) NOT NULL DEFAULT 0 AFTER reminder_h30_sent,
  ADD COLUMN IF NOT EXISTS reminder_h180_sent TINYINT(1) NOT NULL DEFAULT 0 AFTER reminder_h90_sent;

-- Index untuk mempercepat query View (filter baris yang belum dikirimi)
-- Cek dulu apakah index sudah ada sebelum menambahkan
SELECT COUNT(*) INTO @idx_exists
  FROM information_schema.statistics
  WHERE table_schema = 'fitmotor_crm'
    AND table_name   = 'riwayat_servis'
    AND index_name   = 'idx_reminder_tanggal';

SET @ddl = IF(@idx_exists = 0,
  'ALTER TABLE riwayat_servis ADD INDEX idx_reminder_tanggal (tanggal, reminder_h1_sent, reminder_h30_sent, reminder_h90_sent, reminder_h180_sent)',
  'SELECT "Index idx_reminder_tanggal already exists, skip" AS info'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Step 2 OK: riwayat_servis columns added' AS status;

-- ── STEP 3: Tambah UNIQUE INDEX di booking_id ─────────────────
-- Agar INSERT IGNORE di server.js bisa idempoten (mencegah duplikat)
-- booking_id nullable — MySQL mengizinkan multi NULL di UNIQUE index (aman)
SELECT COUNT(*) INTO @uidx_exists
  FROM information_schema.statistics
  WHERE table_schema = 'fitmotor_crm'
    AND table_name   = 'riwayat_servis'
    AND index_name   = 'uq_booking_id';

SET @ddl2 = IF(@uidx_exists = 0,
  'ALTER TABLE riwayat_servis ADD UNIQUE INDEX uq_booking_id (booking_id)',
  'SELECT "UNIQUE index uq_booking_id already exists, skip" AS info'
);
PREPARE stmt2 FROM @ddl2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SELECT 'Step 3 OK: UNIQUE index on booking_id added' AS status;

-- ── STEP 4: Buat View v_periodic_reminder_pending ────────────
-- Logic: untuk setiap riwayat_servis, cek apakah hari ini tepat H+1/30/90/180
-- dan flag reminder-nya belum dikirim (= 0)
-- LEFT JOIN pelanggan agar robust jika data pelanggan belum tersimpan

CREATE OR REPLACE VIEW v_periodic_reminder_pending AS
SELECT
  rs.id          AS riwayat_id,
  rs.nopol,
  rs.nomor_wa,
  rs.jenis_servis,
  COALESCE(p.nama, rs.nopol) AS nama_pelanggan,
  COALESCE(p.motor, rs.jenis_servis) AS motor,
  c.nama         AS nama_cabang,
  c.device_id,
  DATEDIFF(CURDATE(), rs.tanggal) AS interval_hari
FROM riwayat_servis rs
LEFT JOIN pelanggan p  ON rs.nomor_wa = p.nomor_wa
JOIN      cabang    c  ON rs.cabang_id = c.id
WHERE
  (DATEDIFF(CURDATE(), rs.tanggal) = 1   AND rs.reminder_h1_sent   = 0) OR
  (DATEDIFF(CURDATE(), rs.tanggal) = 30  AND rs.reminder_h30_sent  = 0) OR
  (DATEDIFF(CURDATE(), rs.tanggal) = 90  AND rs.reminder_h90_sent  = 0) OR
  (DATEDIFF(CURDATE(), rs.tanggal) = 180 AND rs.reminder_h180_sent = 0);

SELECT 'Step 4 OK: v_periodic_reminder_pending view created' AS status;

-- ── VERIFIKASI AKHIR ──────────────────────────────────────────
SHOW COLUMNS FROM riwayat_servis LIKE 'reminder_%';
SELECT * FROM v_periodic_reminder_pending LIMIT 5;
SELECT 'Migration V3 Selesai!' AS final_status;
