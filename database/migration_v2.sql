SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE booking;
TRUNCATE TABLE sesi_chat;
TRUNCATE TABLE pelanggan;
TRUNCATE TABLE log_pesan;
TRUNCATE TABLE log_error;
TRUNCATE TABLE riwayat_servis;
SET FOREIGN_KEY_CHECKS = 1;

-- Update device_id & nomor_wa semua cabang
-- device_id memakai format fitmotor_{id} konsisten dengan GoWA Engine
-- Nomor WA diambil dari data GoWA yang sudah login
UPDATE cabang SET 
  device_id = 'fitmotor_adiwerna',
  nomor_wa  = '6285609941624'
WHERE id = 'adiwerna';

UPDATE cabang SET 
  device_id = 'fitmotor_cikditiro',
  nomor_wa  = '628113438800'
WHERE id = 'cikditiro';

UPDATE cabang SET 
  device_id = 'fitmotor_pacul',
  nomor_wa  = '6283116105550'
WHERE id = 'pacul';

-- Pesalakan & Trayeman belum ada nomor aktif, isi placeholder bisa diupdate nanti
UPDATE cabang SET device_id = 'fitmotor_pesalakan' WHERE id = 'pesalakan';
UPDATE cabang SET device_id = 'fitmotor_trayeman'  WHERE id = 'trayeman';

-- =====================================================
-- Stored Procedure: Cek Nopol Aktif (Anti-Booking Ganda Lintas Cabang)
-- Logic:
--   1. Cari booking AKTIF (status pending/proses) untuk nopol yang sama
--      dalam window 24 jam terakhir
--   2. Jika ditemukan di cabang BERBEDA, kembalikan data cabang asalnya
--   3. Jika ditemukan di cabang SAMA, biarkan (customer bisa retry)
--   4. Jika tidak ada, aman → lanjut proses
-- =====================================================
DROP PROCEDURE IF EXISTS cek_nopol_aktif;
DELIMITER //
CREATE PROCEDURE cek_nopol_aktif(
  IN  p_nopol      VARCHAR(20),
  IN  p_cabang_id  VARCHAR(50),
  OUT o_is_blocked TINYINT,
  OUT o_kode_existing VARCHAR(20),
  OUT o_cabang_existing VARCHAR(50)
)
BEGIN
  DECLARE v_id          VARCHAR(20) DEFAULT NULL;
  DECLARE v_cabang      VARCHAR(50) DEFAULT NULL;

  SELECT id, cabang_id 
  INTO   v_id, v_cabang
  FROM   booking
  WHERE  nopol = p_nopol
    AND  status IN ('pending', 'proses')
    AND  created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL AND v_cabang != p_cabang_id THEN
    -- Ada booking aktif di cabang LAIN → BLOKIR
    SET o_is_blocked      = 1;
    SET o_kode_existing   = v_id;
    SET o_cabang_existing = v_cabang;
  ELSE
    -- Tidak ada, atau cabang sama → AMAN
    SET o_is_blocked      = 0;
    SET o_kode_existing   = NULL;
    SET o_cabang_existing = NULL;
  END IF;
END //
DELIMITER ;

-- Verifikasi
SELECT * FROM cabang;
SHOW PROCEDURE STATUS WHERE Db = 'fitmotor_crm' AND Name = 'cek_nopol_aktif';
