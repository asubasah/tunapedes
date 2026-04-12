// ============================================================
// FitMotor WhatsApp AI CRM — Main Entry Point
// File: Code.gs
// Deskripsi: Handler utama untuk semua webhook dari Antigravity
//            dan Google Sheets operations
// Author: Fit Motor Dev Team
// Version: 1.0.0
// ============================================================

// ── KONSTANTA GLOBAL ─────────────────────────────────────────

const CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  GMAPS_API_KEY:  PropertiesService.getScriptProperties().getProperty('GMAPS_API_KEY'),
  AG_WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('AG_WEBHOOK_URL'),
  TIMEZONE: 'Asia/Jakarta',
  AI_PAUSE_SECONDS: 900,
  FALLBACK_MAX: 3,
  GHOSTING_HOURS: 24,
  KOMPLAIN_ESKALASI_HOURS: 2,
  JEMPUT_MAX_KM: 7,
  JEMPUT_MIN_BIAYA: 6000,
  JEMPUT_RATE_PER_KM: 3000,
  CUTOFF_WEEKDAY_MIN: 60,
  CUTOFF_WEEKEND_MIN: 120,
};

// Nama tab Google Sheets — terpusat agar mudah diubah
const SHEETS = {
  PELANGGAN:      'Pelanggan',
  BOOKING:        'Booking',
  RIWAYAT_SERVIS: 'Riwayat_Servis',
  NON_AI_LIST:    'Non_AI_List',
  LOG_ERROR:      'Log_Error',
};

// Indeks kolom Sheets (0-indexed) — agar tidak hardcode angka
const COL = {
  PELANGGAN: {
    ID: 0, NAMA: 1, NOMOR_WA: 2, MOTOR: 3, NOPOL: 4,
    PERNAH_JEMPUT: 5, ALAMAT_JEMPUT_TERAKHIR: 6,
    CABANG_DEFAULT: 7, IS_NON_AI: 8, TANGGAL_DAFTAR: 9,
  },
  BOOKING: {
    ID: 0, NOPOL: 1, NAMA: 2, NOMOR_WA: 3, WAKTU_BOOKING: 4,
    LAYANAN: 5, CABANG: 6, STATUS_JEMPUT: 7, JARAK_KM: 8,
    BIAYA_JEMPUT: 9, STATUS_BOOKING: 10, REMINDER_SENT: 11,
    CREATED_AT: 12,
  },
  RIWAYAT: {
    NOPOL: 0, TANGGAL: 1, JENIS_SERVIS: 2, OLI: 3,
    KILOMETER: 4, CABANG: 5, TEKNISI: 6, CATATAN: 7,
  },
  NON_AI: {
    NOMOR_WA: 0, NAMA: 1, ALASAN: 2, ADDED_BY: 3, ADDED_AT: 4,
  },
};

// ── ENTRY POINT WEBHOOK ──────────────────────────────────────

/**
 * doPost — Menerima semua request dari Antigravity
 * Antigravity mengirim JSON payload ke URL webhook Google Apps Script
 *
 * BUG PREVENTION:
 *  - Selalu cek type payload sebelum proses
 *  - Wrap semua dalam try-catch agar satu error tidak crash semua
 *  - Log setiap error ke sheet Log_Error
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    // Cegah race condition: max 30 detik menunggu lock
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: 'error', message: 'Empty payload' });
    }

    const payload = JSON.parse(e.postData.contents);
    const { type } = payload;

    Logger.log('[doPost] Received type: ' + type);

    switch (type) {
      // Dari Antigravity scheduler jam 06:00
      case 'TRIGGER_REMINDER':
        return jsonResponse(sendDailyReminders());

      // Cek apakah nomor ada di Non-AI List
      case 'CHECK_NON_AI':
        return jsonResponse(checkNonAiList(payload.nomor_wa));

      // Lookup pelanggan by nomor WA
      case 'LOOKUP_PELANGGAN':
        return jsonResponse(lookupPelanggan(payload.nomor_wa));

      // Simpan booking baru
      case 'SAVE_BOOKING':
        return jsonResponse(saveBooking(payload));

      // Cek riwayat servis by nopol
      case 'GET_RIWAYAT':
        return jsonResponse(getRiwayatServis(payload.nopol));

      // Kalkulasi jarak jemput antar
      case 'CALC_JARAK':
        return jsonResponse(calculateJarak(payload.origin, payload.cabang_id));

      // Update pernah_jemput dan alamat terakhir
      case 'UPDATE_JEMPUT':
        return jsonResponse(updateJemputData(payload.nomor_wa, payload.alamat));

      // Tambah ke Non-AI List
      case 'ADD_NON_AI':
        return jsonResponse(addToNonAiList(payload));

      // Validasi waktu booking
      case 'VALIDATE_BOOKING_TIME':
        return jsonResponse(validateBookingTime(payload.cabang_id, payload.waktu_booking));

      // Cek kapasitas cabang
      case 'CHECK_CAPACITY':
        return jsonResponse(checkCabangCapacity(payload.cabang_id, payload.tanggal));

      default:
        logError('doPost', 'Unknown type: ' + type, payload);
        return jsonResponse({ status: 'error', message: 'Unknown request type: ' + type });
    }

  } catch (err) {
    logError('doPost', err.message, e ? e.postData.contents : 'no payload');
    return jsonResponse({ status: 'error', message: err.message });

  } finally {
    // PENTING: Selalu release lock, bahkan jika error
    lock.releaseLock();
  }
}

// ── HELPER FUNCTIONS ─────────────────────────────────────────

/**
 * Ambil sheet dengan validasi — jangan pernah assume sheet ada
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tidak ditemukan: ' + sheetName);
  }
  return sheet;
}

/**
 * Format response JSON yang konsisten
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Generate UUID sederhana untuk ID booking/pelanggan
 */
function generateId(prefix) {
  const ts = new Date().getTime().toString(36);
  const rand = Math.random().toString(36).substr(2, 5);
  return (prefix || 'ID') + '-' + ts + '-' + rand;
}

/**
 * Format tanggal ke zona waktu Jakarta
 */
function formatWIB(date, format) {
  return Utilities.formatDate(
    date instanceof Date ? date : new Date(date),
    CONFIG.TIMEZONE,
    format || 'yyyy-MM-dd HH:mm:ss'
  );
}

/**
 * Dapatkan jam sekarang dalam WIB sebagai number (e.g., 14.5 = 14:30)
 */
function getCurrentHourWIB() {
  const now = new Date();
  const wibStr = formatWIB(now, 'HH:mm');
  const [h, m] = wibStr.split(':').map(Number);
  return h + m / 60;
}

/**
 * Cek apakah hari ini weekend (Sabtu/Minggu)
 */
function isWeekend() {
  const day = formatWIB(new Date(), 'EEEE'); // e.g., "Saturday"
  return day === 'Saturday' || day === 'Sunday';
}

/**
 * Log error ke sheet Log_Error agar mudah di-debug
 * BUG PREVENTION: Jangan throw error dari fungsi ini
 */
function logError(context, message, detail) {
  try {
    const sheet = getSheet(SHEETS.LOG_ERROR);
    sheet.appendRow([
      formatWIB(new Date()),
      context,
      message,
      typeof detail === 'object' ? JSON.stringify(detail) : String(detail)
    ]);
  } catch (e) {
    // Jika logError sendiri error, hanya Logger.log (tidak throw)
    Logger.log('[logError FAILED] ' + e.message);
  }
}

/**
 * Kirim notifikasi ke Antigravity Webhook
 * BUG PREVENTION: Retry 3x jika gagal
 */
function sendToAntigravity(payload, maxRetry) {
  maxRetry = maxRetry || 3;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      const response = UrlFetchApp.fetch(CONFIG.AG_WEBHOOK_URL, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        // Timeout 10 detik
        deadline: 10,
      });

      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        return { status: 'ok', attempt };
      }

      Logger.log('[sendToAntigravity] Attempt ' + attempt + ' failed with code ' + code);

    } catch (err) {
      Logger.log('[sendToAntigravity] Attempt ' + attempt + ' error: ' + err.message);
      if (attempt < maxRetry) {
        Utilities.sleep(1000 * attempt); // exponential backoff: 1s, 2s, 3s
      }
    }
  }

  logError('sendToAntigravity', 'All retries failed', payload);
  return { status: 'error', message: 'Semua retry gagal' };
}
