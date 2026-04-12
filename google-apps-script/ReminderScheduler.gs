// ============================================================
// FitMotor — Reminder & Ghosting Scheduler
// File: ReminderScheduler.gs
// ============================================================

/**
 * sendDailyReminders — Dipanggil otomatis setiap hari jam 06:00 WIB
 * via Google Apps Script Time-Based Trigger
 *
 * BUG PREVENTION:
 *  - Cek reminder_sent sebelum kirim (cegah double send)
 *  - Gunakan lock agar tidak jalan 2x jika trigger overlap
 *  - Kirim berurutan dengan delay kecil agar tidak spam WA API
 *  - Log setiap pengiriman
 *  - Batas maksimal 50 reminder per sesi (safety valve)
 */
function sendDailyReminders() {
  const lock = LockService.getScriptLock();

  try {
    // Jika ada proses lain yang sedang jalan, skip (jangan dobel)
    if (!lock.tryLock(5000)) {
      Logger.log('[Reminder] Skipped — lock sudah dipegang proses lain');
      return { status: 'skipped', reason: 'lock_busy' };
    }

    const today = formatWIB(new Date(), 'yyyy-MM-dd');
    const sheet = getSheet(SHEETS.BOOKING);
    const data = sheet.getDataRange().getValues();

    let sentCount = 0;
    const MAX_PER_SESSION = 50;
    const results = [];

    for (let i = 1; i < data.length; i++) {
      if (sentCount >= MAX_PER_SESSION) {
        Logger.log('[Reminder] Batas ' + MAX_PER_SESSION + ' tercapai, sisanya besok');
        break;
      }

      const row = data[i];
      const waktuBooking  = row[COL.BOOKING.WAKTU_BOOKING];
      const statusBooking = String(row[COL.BOOKING.STATUS_BOOKING]);
      const reminderSent  = row[COL.BOOKING.REMINDER_SENT];
      const bookingDate   = String(waktuBooking).split(' ')[0];

      // Hanya kirim untuk: hari ini + status pending/confirmed + belum dikirim
      if (bookingDate !== today) continue;
      if (statusBooking === 'batal' || statusBooking === 'selesai') continue;
      if (reminderSent === true || reminderSent === 'TRUE') continue;

      const payload = {
        type: 'SEND_REMINDER',
        nomor_wa: normalizePhone(String(row[COL.BOOKING.NOMOR_WA])),
        nama: row[COL.BOOKING.NAMA],
        nopol: row[COL.BOOKING.NOPOL],
        layanan: row[COL.BOOKING.LAYANAN],
        waktu_booking: waktuBooking,
        cabang: row[COL.BOOKING.CABANG],
        status_jemput: row[COL.BOOKING.STATUS_JEMPUT],
        biaya_jemput: row[COL.BOOKING.BIAYA_JEMPUT],
      };

      const result = sendToAntigravity(payload);

      if (result.status === 'ok') {
        // Update reminder_sent = TRUE di sheet
        sheet.getRange(i + 1, COL.BOOKING.REMINDER_SENT + 1).setValue(true);
        sentCount++;
        results.push({ row: i + 1, booking_id: row[COL.BOOKING.ID], status: 'sent' });
        Logger.log('[Reminder] Sent to ' + payload.nomor_wa + ' for booking ' + row[COL.BOOKING.ID]);
      } else {
        results.push({ row: i + 1, booking_id: row[COL.BOOKING.ID], status: 'failed', error: result.message });
        logError('sendDailyReminders', 'Gagal kirim ke ' + payload.nomor_wa, result);
      }

      // Delay 500ms antar pengiriman — cegah rate limit WA
      Utilities.sleep(500);
    }

    Logger.log('[Reminder] Session selesai. Total terkirim: ' + sentCount);
    return { status: 'done', sent: sentCount, results };

  } finally {
    lock.releaseLock();
  }
}

/**
 * checkGhostingPelanggan — Cek pelanggan yang sudah tidak pernah balas 24 jam
 * Dipanggil via trigger terpisah setiap 6 jam
 *
 * BUG PREVENTION:
 *  - Hanya trigger untuk booking dengan status 'pending' (bukan confirmed)
 *    artinya pelanggan mulai tanya tapi tidak lanjut konfirmasi
 *  - Cek flag 'ghosting_sent' agar tidak kirim 2x
 *  - Batas 48 jam: jika sudah dikirim follow-up tapi masih tidak balas,
 *    tutup sesi dan notif admin untuk follow-up manual
 */
function checkGhostingPelanggan() {
  const now = new Date();
  const sheet = getSheet(SHEETS.BOOKING);
  const data = sheet.getDataRange().getValues();
  const results = [];

  // Header check — kolom ghosting_follow_sent (kolom ke-14, index 13)
  // Tambahkan kolom ini ke sheet jika belum ada
  const GHOSTING_COL = 14; // 1-indexed

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[COL.BOOKING.STATUS_BOOKING]);
    const createdAt = new Date(row[COL.BOOKING.CREATED_AT]);
    const ghostingSent = row[GHOSTING_COL - 1]; // 0-indexed

    // Hanya proses yang masih pending
    if (status !== 'pending') continue;

    // Hitung selisih waktu
    const jamSelisih = (now - createdAt) / (1000 * 60 * 60);

    // Follow-up pertama: 24 jam tidak action
    if (jamSelisih >= 24 && !ghostingSent) {
      const payload = {
        type: 'GHOSTING_FOLLOWUP_1',
        nomor_wa: normalizePhone(String(row[COL.BOOKING.NOMOR_WA])),
        nama: row[COL.BOOKING.NAMA],
        nopol: row[COL.BOOKING.NOPOL],
        layanan: row[COL.BOOKING.LAYANAN],
        booking_id: row[COL.BOOKING.ID],
      };

      const result = sendToAntigravity(payload);
      if (result.status === 'ok') {
        sheet.getRange(i + 1, GHOSTING_COL).setValue('SENT_1');
        results.push({ booking_id: row[COL.BOOKING.ID], action: 'followup_1' });
      }

      Utilities.sleep(300);

    // Follow-up kedua / tutup sesi: 48 jam masih tidak action
    } else if (jamSelisih >= 48 && ghostingSent === 'SENT_1') {
      const payload = {
        type: 'GHOSTING_CLOSE_SESSION',
        nomor_wa: normalizePhone(String(row[COL.BOOKING.NOMOR_WA])),
        nama: row[COL.BOOKING.NAMA],
        booking_id: row[COL.BOOKING.ID],
      };

      sendToAntigravity(payload);
      sheet.getRange(i + 1, COL.BOOKING.STATUS_BOOKING + 1).setValue('batal');
      sheet.getRange(i + 1, GHOSTING_COL).setValue('CLOSED');

      // Notifikasi admin untuk manual follow-up
      notifikasiAdminGhosting(row);
      results.push({ booking_id: row[COL.BOOKING.ID], action: 'closed' });

      Utilities.sleep(300);
    }
  }

  return { status: 'done', processed: results.length, results };
}

/**
 * Kirim notifikasi ke admin jika pelanggan ghosting 48 jam
 */
function notifikasiAdminGhosting(row) {
  // Kirim ke semua admin melalui Antigravity
  sendToAntigravity({
    type: 'NOTIF_ADMIN_GHOSTING',
    booking_id: row[COL.BOOKING.ID],
    nama: row[COL.BOOKING.NAMA],
    nomor_wa: row[COL.BOOKING.NOMOR_WA],
    layanan: row[COL.BOOKING.LAYANAN],
    cabang: row[COL.BOOKING.CABANG],
    catatan: 'Pelanggan tidak merespons 48 jam — sesi otomatis ditutup',
  });
}

/**
 * Setup semua trigger yang diperlukan
 * Jalankan ini SEKALI saat setup awal
 *
 * BUG PREVENTION:
 *  - Hapus trigger lama sebelum buat baru (cegah duplikat trigger)
 */
function setupAllTriggers() {
  // Hapus semua trigger lama
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // Trigger 1: Reminder harian jam 06:00 WIB
  ScriptApp.newTrigger('sendDailyReminders')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone('Asia/Jakarta')
    .create();

  // Trigger 2: Cek ghosting setiap 6 jam
  ScriptApp.newTrigger('checkGhostingPelanggan')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('[Setup] Triggers berhasil dibuat: Reminder (06:00 WIB) + Ghosting (setiap 6 jam)');
  return { status: 'ok', triggers_created: 2 };
}

/**
 * Hapus trigger duplikat jika ada yang terjadi secara tidak sengaja
 * Jalankan manual dari Apps Script editor jika ada masalah
 */
function cleanupDuplicateTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const seen = {};
  let removed = 0;

  triggers.forEach(trigger => {
    const name = trigger.getHandlerFunction();
    if (seen[name]) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
      Logger.log('[Cleanup] Hapus trigger duplikat: ' + name);
    } else {
      seen[name] = true;
    }
  });

  return { status: 'done', removed };
}
