-- ============================================================
-- FITMOTOR CRM — MySQL Database Schema
-- Stack: GoWA + n8n + MySQL + Gemini API
-- ============================================================
-- Jalankan: mysql -u root -p < fitmotor_schema.sql

CREATE DATABASE IF NOT EXISTS fitmotor_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fitmotor_crm;

-- ── TABEL CABANG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cabang (
  id            VARCHAR(20)   PRIMARY KEY,
  nama          VARCHAR(100)  NOT NULL,
  alamat        TEXT          NOT NULL,
  nomor_wa      VARCHAR(20)   NOT NULL,         -- nomor WA Business cabang (GoWA device)
  device_id     VARCHAR(50)   NULL,             -- GoWA device_id setelah connect
  koordinat_lat DECIMAL(10,6) NOT NULL,
  koordinat_lng DECIMAL(10,6) NOT NULL,
  jam_buka      TIME          NOT NULL DEFAULT '08:00:00',
  jam_tutup     TIME          NOT NULL DEFAULT '17:00:00',
  kapasitas     INT           NOT NULL DEFAULT 25,
  aktif         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Data awal 5 cabang (koordinat dummy Tegal — update sebelum go-live)
INSERT INTO cabang (id, nama, alamat, nomor_wa, koordinat_lat, koordinat_lng, kapasitas) VALUES
('adiwerna',  'Adiwerna',          'Jl. Raya Adiwerna, Tegal',       '628XXXXXXXXXX', -6.9089, 109.1156, 30),
('pesalakan', 'Pesalakan',         'Jl. Raya Pesalakan, Tegal',      '628XXXXXXXXXX', -6.8912, 109.1234, 25),
('pacul',     'Pacul',             'Jl. Pacul, Tegal',               '628XXXXXXXXXX', -6.8756, 109.1189, 20),
('cikditiro', 'Cikditiro',         'Jl. Cikditiro, Tegal',           '628XXXXXXXXXX', -6.8634, 109.1312, 20),
('trayeman',  'Trayeman (Slawi)',  'Jl. Trayeman, Slawi, Tegal',     '628XXXXXXXXXX', -6.9823, 109.1412, 25)
ON DUPLICATE KEY UPDATE nama=VALUES(nama);

-- ── TABEL PELANGGAN ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pelanggan (
  id                     VARCHAR(30)  PRIMARY KEY,
  nama                   VARCHAR(150) NOT NULL,
  nomor_wa               VARCHAR(20)  NOT NULL UNIQUE,   -- format: 628xxx
  motor                  VARCHAR(100) NOT NULL,
  nopol                  VARCHAR(15)  NOT NULL,
  pernah_jemput          TINYINT(1)   NOT NULL DEFAULT 0,
  alamat_jemput_terakhir TEXT         NULL,
  cabang_default         VARCHAR(20)  NULL,
  is_non_ai              TINYINT(1)   NOT NULL DEFAULT 0,
  fallback_count         INT          NOT NULL DEFAULT 0,
  ai_paused_until        DATETIME     NULL,               -- NULL = AI aktif
  sesi_aktif             VARCHAR(50)  NULL,               -- ID sesi chat aktif
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nomor_wa (nomor_wa),
  INDEX idx_nopol (nopol),
  FOREIGN KEY (cabang_default) REFERENCES cabang(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── TABEL NON_AI_LIST ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS non_ai_list (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  nomor_wa   VARCHAR(20)  NOT NULL UNIQUE,
  nama       VARCHAR(150) NOT NULL,
  alasan     VARCHAR(255) NOT NULL DEFAULT 'VIP',
  added_by   VARCHAR(100) NOT NULL DEFAULT 'Admin',
  added_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nomor_wa (nomor_wa)
) ENGINE=InnoDB;

-- ── TABEL BOOKING ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking (
  id              VARCHAR(30)   PRIMARY KEY,
  nopol           VARCHAR(15)   NOT NULL,
  nama_pelanggan  VARCHAR(150)  NOT NULL,
  nomor_wa        VARCHAR(20)   NOT NULL,
  cabang_id       VARCHAR(20)   NOT NULL,
  waktu_booking   DATETIME      NOT NULL,
  layanan         VARCHAR(100)  NOT NULL,
  status_jemput   ENUM('antar_sendiri','jemput_antar') NOT NULL DEFAULT 'antar_sendiri',
  jarak_km        DECIMAL(5,1)  NULL,
  biaya_jemput    INT           NOT NULL DEFAULT 0,
  alamat_jemput   TEXT          NULL,
  status          ENUM('pending','confirmed','selesai','batal') NOT NULL DEFAULT 'pending',
  reminder_sent   TINYINT(1)    NOT NULL DEFAULT 0,
  ghosting_status ENUM('none','sent_1','closed') NOT NULL DEFAULT 'none',
  catatan         TEXT          NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nomor_wa    (nomor_wa),
  INDEX idx_nopol       (nopol),
  INDEX idx_cabang_date (cabang_id, waktu_booking),
  INDEX idx_status      (status),
  INDEX idx_reminder    (reminder_sent, waktu_booking),
  FOREIGN KEY (cabang_id) REFERENCES cabang(id)
) ENGINE=InnoDB;

-- ── TABEL RIWAYAT SERVIS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS riwayat_servis (
  id           INT           AUTO_INCREMENT PRIMARY KEY,
  nopol        VARCHAR(15)   NOT NULL,
  nomor_wa     VARCHAR(20)   NOT NULL,
  cabang_id    VARCHAR(20)   NOT NULL,
  tanggal      DATE          NOT NULL,
  jenis_servis VARCHAR(100)  NOT NULL,
  oli          VARCHAR(100)  NULL,
  kilometer    INT           NULL,
  teknisi      VARCHAR(100)  NULL,
  booking_id   VARCHAR(30)   NULL,
  catatan      TEXT          NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nopol    (nopol),
  INDEX idx_nomor_wa (nomor_wa),
  INDEX idx_tanggal  (tanggal),
  FOREIGN KEY (cabang_id)  REFERENCES cabang(id),
  FOREIGN KEY (booking_id) REFERENCES booking(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── TABEL SESI CHAT ──────────────────────────────────────────
-- Untuk track context percakapan pelanggan di n8n
CREATE TABLE IF NOT EXISTS sesi_chat (
  id            VARCHAR(50)   PRIMARY KEY,               -- format: {nomor_wa}_{timestamp}
  nomor_wa      VARCHAR(20)   NOT NULL,
  cabang_id     VARCHAR(20)   NULL,
  step_aktif    VARCHAR(100)  NOT NULL DEFAULT 'greeting', -- step flow saat ini
  context_json  JSON          NULL,                       -- data sementara (nopol, layanan, dll)
  status        ENUM('aktif','selesai','eskalasi') NOT NULL DEFAULT 'aktif',
  last_activity DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nomor_wa (nomor_wa),
  INDEX idx_status   (status),
  INDEX idx_last_act (last_activity)
) ENGINE=InnoDB;

-- ── TABEL LOG ERROR ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_error (
  id         INT           AUTO_INCREMENT PRIMARY KEY,
  source     VARCHAR(100)  NOT NULL,  -- 'n8n', 'gowa', 'mysql'
  context    VARCHAR(255)  NOT NULL,
  message    TEXT          NOT NULL,
  detail     JSON          NULL,
  nomor_wa   VARCHAR(20)   NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source     (source),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- ── TABEL LOG PESAN ──────────────────────────────────────────
-- Audit trail semua pesan masuk/keluar
CREATE TABLE IF NOT EXISTS log_pesan (
  id          BIGINT        AUTO_INCREMENT PRIMARY KEY,
  nomor_wa    VARCHAR(20)   NOT NULL,
  device_id   VARCHAR(50)   NOT NULL,   -- GoWA device_id (cabang mana)
  arah        ENUM('masuk','keluar')  NOT NULL,
  tipe        VARCHAR(50)   NOT NULL,   -- text, image, location, dll
  isi         TEXT          NULL,
  ai_response TEXT          NULL,
  intent      VARCHAR(100)  NULL,       -- intent yang terdeteksi AI
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nomor_wa  (nomor_wa),
  INDEX idx_device    (device_id),
  INDEX idx_created   (created_at)
) ENGINE=InnoDB;

-- ── VIEW BOOKING HARI INI ────────────────────────────────────
CREATE OR REPLACE VIEW v_booking_hari_ini AS
SELECT
  b.*,
  c.nama AS nama_cabang,
  c.nomor_wa AS wa_cabang,
  c.device_id
FROM booking b
JOIN cabang c ON b.cabang_id = c.id
WHERE DATE(b.waktu_booking) = CURDATE()
  AND b.status NOT IN ('batal');

-- ── VIEW REMINDER PENDING ────────────────────────────────────
CREATE OR REPLACE VIEW v_reminder_pending AS
SELECT
  b.id, b.nopol, b.nama_pelanggan, b.nomor_wa,
  b.waktu_booking, b.layanan, b.status_jemput,
  b.biaya_jemput, b.alamat_jemput,
  c.nama AS nama_cabang, c.device_id
FROM booking b
JOIN cabang c ON b.cabang_id = c.id
WHERE DATE(b.waktu_booking) = CURDATE()
  AND b.status IN ('pending','confirmed')
  AND b.reminder_sent = 0;

-- ── VIEW GHOSTING PENDING ────────────────────────────────────
CREATE OR REPLACE VIEW v_ghosting_pending AS
SELECT
  b.id, b.nopol, b.nama_pelanggan, b.nomor_wa,
  b.waktu_booking, b.layanan, b.ghosting_status,
  TIMESTAMPDIFF(HOUR, b.created_at, NOW()) AS jam_sejak_buat,
  c.nama AS nama_cabang, c.device_id
FROM booking b
JOIN cabang c ON b.cabang_id = c.id
WHERE b.status = 'pending'
  AND b.ghosting_status IN ('none','sent_1');

-- ── STORED PROCEDURE: Cek Kapasitas Cabang ───────────────────
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS cek_kapasitas(
  IN p_cabang_id VARCHAR(20),
  IN p_tanggal   DATE,
  OUT p_terpakai INT,
  OUT p_kapasitas INT,
  OUT p_tersedia TINYINT
)
BEGIN
  SELECT COUNT(*) INTO p_terpakai
  FROM booking
  WHERE cabang_id = p_cabang_id
    AND DATE(waktu_booking) = p_tanggal
    AND status != 'batal';

  SELECT kapasitas INTO p_kapasitas
  FROM cabang WHERE id = p_cabang_id;

  SET p_tersedia = IF(p_terpakai < p_kapasitas, 1, 0);
END //
DELIMITER ;

-- ── STORED PROCEDURE: Cek Duplikat Booking ───────────────────
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS cek_duplikat(
  IN p_nopol    VARCHAR(15),
  IN p_tanggal  DATE,
  OUT p_ada     TINYINT,
  OUT p_booking_id VARCHAR(30)
)
BEGIN
  SELECT COUNT(*) > 0, id INTO p_ada, p_booking_id
  FROM booking
  WHERE nopol = UPPER(p_nopol)
    AND DATE(waktu_booking) = p_tanggal
    AND status NOT IN ('batal','selesai')
  LIMIT 1;
END //
DELIMITER ;

-- Selesai
SELECT 'FitMotor CRM Schema berhasil dibuat!' AS status;
