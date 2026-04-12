// ============================================================
// FITMOTOR CRM BACKEND — ALL-IN-ONE
// Copy-paste seluruh isi file ini ke Code.gs di Apps Script
// ============================================================

// ── CONFIG & CONSTANTS ───────────────────────────────────────

const CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  GMAPS_API_KEY:  PropertiesService.getScriptProperties().getProperty('GMAPS_API_KEY'),
  AG_WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('AG_WEBHOOK_URL'),
  TIMEZONE: 'Asia/Jakarta',
  AI_PAUSE_SECONDS: 900,
  FALLBACK_MAX: 3,
  GHOSTING_HOURS: 24,
  JEMPUT_MAX_KM: 7,
  JEMPUT_MIN_BIAYA: 6000,
  JEMPUT_RATE_PER_KM: 3000,
  CUTOFF_WEEKDAY_MIN: 60,
  CUTOFF_WEEKEND_MIN: 120,
};

const SHEETS = {
  PELANGGAN:      'Pelanggan',
  BOOKING:        'Booking',
  RIWAYAT_SERVIS: 'Riwayat_Servis',
  NON_AI_LIST:    'Non_AI_List',
  LOG_ERROR:      'Log_Error',
};

const COL = {
  PELANGGAN: {
    ID: 0, NAMA: 1, NOMOR_WA: 2, MOTOR: 3, NOPOL: 4,
    PERNAH_JEMPUT: 5, ALAMAT_JEMPUT_TERAKHIR: 6,
    CABANG_DEFAULT: 7, IS_NON_AI: 8, TANGGAL_DAFTAR: 9,
  },
  BOOKING: {
    ID: 0, NOPOL: 1, NAMA: 2, NOMOR_WA: 3, WAKTU_BOOKING: 4,
    LAYANAN: 5, CABANG: 6, STATUS_JEMPUT: 7, JARAK_KM: 8,
    BIAYA_JEMPUT: 9, STATUS_BOOKING: 10, REMINDER_SENT: 11, CREATED_AT: 12,
  },
  RIWAYAT: {
    NOPOL: 0, TANGGAL: 1, JENIS_SERVIS: 2, OLI: 3,
    KILOMETER: 4, CABANG: 5, TEKNISI: 6, CATATAN: 7,
  },
  NON_AI: { NOMOR_WA: 0, NAMA: 1, ALASAN: 2, ADDED_BY: 3, ADDED_AT: 4 },
};

// ── WEBHOOK ENTRY POINT ──────────────────────────────────────

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: 'error', message: 'Empty payload' });
    }
    const payload = JSON.parse(e.postData.contents);
    Logger.log('[doPost] type: ' + payload.type);
    switch (payload.type) {
      case 'TRIGGER_REMINDER':      return jsonResponse(sendDailyReminders());
      case 'TRIGGER_GHOSTING':      return jsonResponse(checkGhostingPelanggan());
      case 'CHECK_NON_AI':          return jsonResponse(checkNonAiList(payload.nomor_wa));
      case 'LOOKUP_PELANGGAN':      return jsonResponse(lookupPelanggan(payload.nomor_wa));
      case 'SAVE_BOOKING':          return jsonResponse(saveBooking(payload));
      case 'GET_RIWAYAT':           return jsonResponse(getRiwayatServis(payload.nopol));
      case 'CALC_JARAK':            return jsonResponse(calculateJarak(payload.origin, payload.cabang_id));
      case 'UPDATE_JEMPUT':         return jsonResponse(updateJemputData(payload.nomor_wa, payload.alamat));
      case 'ADD_NON_AI':            return jsonResponse(addToNonAiList(payload));
      case 'VALIDATE_BOOKING_TIME': return jsonResponse(validateBookingTime(payload.cabang_id, payload.waktu_booking));
      case 'CHECK_CAPACITY':        return jsonResponse(checkCabangCapacity(payload.cabang_id, payload.tanggal));
      default:
        logError('doPost', 'Unknown type: ' + payload.type, payload);
        return jsonResponse({ status: 'error', message: 'Unknown type: ' + payload.type });
    }
  } catch (err) {
    logError('doPost', err.message, e ? e.postData.contents : 'no payload');
    return jsonResponse({ status: 'error', message: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ── HELPERS ──────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + name);
  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateId(prefix) {
  return (prefix || 'ID') + '-' + new Date().getTime().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
}

function formatWIB(date, format) {
  return Utilities.formatDate(
    date instanceof Date ? date : new Date(date),
    CONFIG.TIMEZONE,
    format || 'yyyy-MM-dd HH:mm:ss'
  );
}

function normalizePhone(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (!d.startsWith('62')) d = '62' + d;
  return d;
}

function logError(context, message, detail) {
  try {
    getSheet(SHEETS.LOG_ERROR).appendRow([
      formatWIB(new Date()), context, message,
      typeof detail === 'object' ? JSON.stringify(detail) : String(detail)
    ]);
  } catch (e) {
    Logger.log('[logError FAILED] ' + e.message);
  }
}

function sendToAntigravity(payload, maxRetry) {
  maxRetry = maxRetry || 3;
  for (let i = 1; i <= maxRetry; i++) {
    try {
      const r = UrlFetchApp.fetch(CONFIG.AG_WEBHOOK_URL, {
        method: 'POST', contentType: 'application/json',
        payload: JSON.stringify(payload), muteHttpExceptions: true, deadline: 10,
      });
      if (r.getResponseCode() >= 200 && r.getResponseCode() < 300) return { status: 'ok', attempt: i };
    } catch (err) {
      if (i < maxRetry) Utilities.sleep(1000 * i);
    }
  }
  logError('sendToAntigravity', 'All retries failed', payload);
  return { status: 'error', message: 'Semua retry gagal' };
}

// ── CABANG DATA ───────────────────────────────────────────────
// GANTI koordinat & nomor WA admin sebelum go-live!

function getCabangById(id) {
  const list = [
    {
      id: 'adiwerna', nama: 'Adiwerna',
      alamat: 'Jl. Raya Adiwerna, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',   // ← GANTI
      koordinat_lat: -6.9089, koordinat_lng: 109.1156,
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      kapasitas_harian: 30, aktif: true
    },
    {
      id: 'pesalakan', nama: 'Pesalakan',
      alamat: 'Jl. Raya Pesalakan, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',   // ← GANTI
      koordinat_lat: -6.8912, koordinat_lng: 109.1234,
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      kapasitas_harian: 25, aktif: true
    },
    {
      id: 'pacul', nama: 'Pacul',
      alamat: 'Jl. Pacul, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',   // ← GANTI
      koordinat_lat: -6.8756, koordinat_lng: 109.1189,
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      kapasitas_harian: 20, aktif: true
    },
    {
      id: 'cikditiro', nama: 'Cikditiro',
      alamat: 'Jl. Cikditiro, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',   // ← GANTI
      koordinat_lat: -6.8634, koordinat_lng: 109.1312,
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      kapasitas_harian: 20, aktif: true
    },
    {
      id: 'trayeman', nama: 'Trayeman',
      alamat: 'Jl. Trayeman, Slawi, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',   // ← GANTI
      koordinat_lat: -6.9823, koordinat_lng: 109.1412,
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      kapasitas_harian: 25, aktif: true
    },
  ];
  return list.find(c => c.id === id) || null;
}

function getAllCabang() {
  return ['adiwerna','pesalakan','pacul','cikditiro','trayeman'].map(id => getCabangById(id));
}

// ── CUSTOMER HANDLER ─────────────────────────────────────────

function lookupPelanggan(nomorWa) {
  if (!nomorWa) return { status: 'error', message: 'Nomor WA kosong' };
  const normalized = normalizePhone(nomorWa);
  const data = getSheet(SHEETS.PELANGGAN).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizePhone(String(data[i][COL.PELANGGAN.NOMOR_WA])) === normalized) {
      return {
        status: 'found', row_index: i + 1,
        nama: data[i][COL.PELANGGAN.NAMA],
        nomor_wa: data[i][COL.PELANGGAN.NOMOR_WA],
        motor: data[i][COL.PELANGGAN.MOTOR],
        nopol: data[i][COL.PELANGGAN.NOPOL],
        pernah_jemput: data[i][COL.PELANGGAN.PERNAH_JEMPUT] === true,
        alamat_jemput_terakhir: data[i][COL.PELANGGAN.ALAMAT_JEMPUT_TERAKHIR] || '',
        is_non_ai: data[i][COL.PELANGGAN.IS_NON_AI] === true,
      };
    }
  }
  return { status: 'not_found', nomor_wa: normalized };
}

function registerPelangganBaru(data) {
  const req = ['nama', 'nomor_wa', 'motor', 'nopol'];
  for (const f of req) if (!data[f]) return { status: 'error', message: 'Field kosong: ' + f };
  if (lookupPelanggan(data.nomor_wa).status === 'found') return { status: 'duplicate' };
  const id = generateId('PLG');
  getSheet(SHEETS.PELANGGAN).appendRow([
    id, String(data.nama).trim(), normalizePhone(data.nomor_wa),
    String(data.motor).trim(), String(data.nopol).toUpperCase().trim(),
    false, '', data.cabang_default || '', false, formatWIB(new Date())
  ]);
  return { status: 'registered', id_pelanggan: id };
}

function checkNonAiList(nomorWa) {
  if (!nomorWa) return { status: 'error', message: 'Nomor WA diperlukan' };
  const normalized = normalizePhone(nomorWa);
  const data = getSheet(SHEETS.NON_AI_LIST).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizePhone(String(data[i][COL.NON_AI.NOMOR_WA])) === normalized)
      return { status: 'found', is_non_ai: true, nama: data[i][COL.NON_AI.NAMA] };
  }
  return { status: 'not_found', is_non_ai: false };
}

function addToNonAiList(data) {
  if (!data.nomor_wa || !data.nama) return { status: 'error', message: 'nomor_wa & nama wajib' };
  if (checkNonAiList(data.nomor_wa).is_non_ai) return { status: 'duplicate' };
  getSheet(SHEETS.NON_AI_LIST).appendRow([
    normalizePhone(data.nomor_wa), data.nama, data.alasan || 'VIP',
    data.added_by || 'Admin', formatWIB(new Date())
  ]);
  return { status: 'added' };
}

function updateJemputData(nomorWa, alamat) {
  const p = lookupPelanggan(nomorWa);
  if (p.status !== 'found') return { status: 'error', message: 'Pelanggan tidak ditemukan' };
  const sheet = getSheet(SHEETS.PELANGGAN);
  sheet.getRange(p.row_index, COL.PELANGGAN.PERNAH_JEMPUT + 1).setValue(true);
  sheet.getRange(p.row_index, COL.PELANGGAN.ALAMAT_JEMPUT_TERAKHIR + 1).setValue(alamat);
  return { status: 'updated' };
}

// ── BOOKING HANDLER ──────────────────────────────────────────

function validateBookingTime(cabangId, waktuBookingStr) {
  if (!cabangId || !waktuBookingStr) return { valid: false, reason: 'Parameter tidak lengkap' };
  const cabang = getCabangById(cabangId);
  if (!cabang) return { valid: false, reason: 'Cabang tidak ditemukan' };
  if (!cabang.aktif) return { valid: false, reason: 'Cabang tidak aktif' };
  let bookingDate;
  try {
    bookingDate = new Date(waktuBookingStr.replace(' ', 'T') + ':00+07:00');
  } catch (e) { return { valid: false, reason: 'Format waktu tidak valid (YYYY-MM-DD HH:MM)' }; }
  if (bookingDate <= new Date()) return { valid: false, reason: 'Waktu booking sudah lewat' };
  const hariMap = {
    'Monday':'Senin','Tuesday':'Selasa','Wednesday':'Rabu','Thursday':'Kamis',
    'Friday':'Jumat','Saturday':'Sabtu','Sunday':'Minggu'
  };
  const hari = hariMap[Utilities.formatDate(bookingDate, CONFIG.TIMEZONE, 'EEEE')];
  if (!cabang.hari_buka.includes(hari)) return { valid: false, reason: 'Cabang tutup hari ' + hari };
  const bookH = parseFloat(Utilities.formatDate(bookingDate, CONFIG.TIMEZONE, 'HH')) +
                parseFloat(Utilities.formatDate(bookingDate, CONFIG.TIMEZONE, 'mm')) / 60;
  const [tH, tM] = cabang.jam_tutup.split(':').map(Number);
  const isWknd = (hari === 'Sabtu' || hari === 'Minggu');
  const cutoff = (tH * 60 + tM - (isWknd ? CONFIG.CUTOFF_WEEKEND_MIN : CONFIG.CUTOFF_WEEKDAY_MIN)) / 60;
  if (bookH >= cutoff) {
    const cs = Math.floor(cutoff) + ':' + String(Math.round((cutoff % 1) * 60)).padStart(2, '0');
    return { valid: false, reason: 'Batas booking jam ' + cs + ' WIB (' + (isWknd ? 'weekend' : 'weekday') + ')' };
  }
  return { valid: true, cabang_nama: cabang.nama, hari, is_weekend: isWknd };
}

function checkCabangCapacity(cabangId, tanggal) {
  const cabang = getCabangById(cabangId);
  if (!cabang) return { available: false, reason: 'Cabang tidak ditemukan' };
  const data = getSheet(SHEETS.BOOKING).getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][COL.BOOKING.CABANG]).toLowerCase() === cabang.nama.toLowerCase() &&
      String(data[i][COL.BOOKING.WAKTU_BOOKING]).split(' ')[0] === tanggal &&
      data[i][COL.BOOKING.STATUS_BOOKING] !== 'batal'
    ) count++;
  }
  return { available: count < cabang.kapasitas_harian, current_count: count, remaining: cabang.kapasitas_harian - count };
}

function checkDuplicateBooking(nopol, tanggal) {
  const n = String(nopol).toUpperCase().trim();
  const data = getSheet(SHEETS.BOOKING).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][COL.BOOKING.NOPOL]).toUpperCase().trim() === n &&
      String(data[i][COL.BOOKING.WAKTU_BOOKING]).split(' ')[0] === tanggal &&
      !['batal','selesai'].includes(String(data[i][COL.BOOKING.STATUS_BOOKING]))
    ) return { isDuplicate: true, bookingId: data[i][COL.BOOKING.ID] };
  }
  return { isDuplicate: false };
}

function saveBooking(data) {
  const req = ['nopol','nama','nomor_wa','waktu_booking','layanan','cabang_id'];
  for (const f of req) if (!data[f]) return { status: 'error', message: 'Field kosong: ' + f };
  const v = validateBookingTime(data.cabang_id, data.waktu_booking);
  if (!v.valid) return { status: 'invalid_time', reason: v.reason };
  const cap = checkCabangCapacity(data.cabang_id, data.waktu_booking.split(' ')[0]);
  if (!cap.available) return { status: 'full', message: 'Cabang penuh untuk hari ini' };
  const dup = checkDuplicateBooking(data.nopol, data.waktu_booking.split(' ')[0]);
  if (dup.isDuplicate) return { status: 'duplicate', existing_booking_id: dup.bookingId };
  const cabang = getCabangById(data.cabang_id);
  const id = generateId('BKG');
  getSheet(SHEETS.BOOKING).appendRow([
    id,
    String(data.nopol).toUpperCase().trim(),
    String(data.nama).trim(),
    normalizePhone(data.nomor_wa),
    data.waktu_booking,
    data.layanan,
    cabang ? cabang.nama : data.cabang_id,
    data.status_jemput || 'antar_sendiri',
    data.jarak_km || '',
    data.biaya_jemput || 0,
    'pending',
    false,
    formatWIB(new Date()),
  ]);
  if (cabang) {
    sendToAntigravity({
      type: 'NOTIF_ADMIN_BOOKING',
      admin_wa: cabang.nomor_wa_admin,
      booking_id: id, nopol: data.nopol, nama: data.nama,
      layanan: data.layanan, waktu: data.waktu_booking, cabang: cabang.nama,
    });
  }
  return { status: 'saved', booking_id: id, cabang: cabang ? cabang.nama : data.cabang_id };
}

function updateBookingStatus(bookingId, newStatus) {
  const valid = ['pending','confirmed','selesai','batal'];
  if (!valid.includes(newStatus)) return { status: 'error', message: 'Status tidak valid' };
  const sheet = getSheet(SHEETS.BOOKING);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.BOOKING.ID] === bookingId) {
      sheet.getRange(i + 1, COL.BOOKING.STATUS_BOOKING + 1).setValue(newStatus);
      return { status: 'updated', booking_id: bookingId, new_status: newStatus };
    }
  }
  return { status: 'error', message: 'Booking tidak ditemukan: ' + bookingId };
}

// ── RIWAYAT HANDLER ──────────────────────────────────────────

function getRiwayatServis(nopol) {
  if (!nopol) return { status: 'error', message: 'Nopol kosong' };
  const n = String(nopol).toUpperCase().replace(/\s+/g, ' ').trim();
  const data = getSheet(SHEETS.RIWAYAT_SERVIS).getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.RIWAYAT.NOPOL]).toUpperCase().replace(/\s+/g, ' ').trim() === n) {
      results.push({
        tanggal: data[i][COL.RIWAYAT.TANGGAL],
        jenis_servis: data[i][COL.RIWAYAT.JENIS_SERVIS],
        oli: data[i][COL.RIWAYAT.OLI] || '-',
        kilometer: data[i][COL.RIWAYAT.KILOMETER] || '-',
        cabang: data[i][COL.RIWAYAT.CABANG],
        teknisi: data[i][COL.RIWAYAT.TEKNISI] || '-',
      });
    }
  }
  if (!results.length) return { status: 'not_found', nopol: n };
  results.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  return { status: 'found', nopol: n, total: results.length, riwayat: results.slice(0, 5) };
}

function addRiwayatServis(data) {
  const req = ['nopol','jenis_servis','cabang'];
  for (const f of req) if (!data[f]) return { status: 'error', message: 'Field kosong: ' + f };
  const tanggal = data.tanggal || formatWIB(new Date(), 'yyyy-MM-dd');
  getSheet(SHEETS.RIWAYAT_SERVIS).appendRow([
    String(data.nopol).toUpperCase().trim(), tanggal, data.jenis_servis,
    data.oli || '', data.kilometer || '', data.cabang, data.teknisi || '', data.catatan || ''
  ]);
  if (data.booking_id) updateBookingStatus(data.booking_id, 'selesai');
  return { status: 'added', nopol: data.nopol, tanggal };
}

// ── JEMPUT / DISTANCE HANDLER ────────────────────────────────

function calculateJarak(originInput, cabangId) {
  if (!originInput || !cabangId) return { status: 'error', message: 'Parameter tidak lengkap' };
  const cabang = getCabangById(cabangId);
  if (!cabang) return { status: 'error', message: 'Cabang tidak ditemukan: ' + cabangId };
  const origin = String(originInput).trim();
  const dest = cabang.koordinat_lat + ',' + cabang.koordinat_lng;
  let resp;
  try {
    resp = UrlFetchApp.fetch(
      'https://maps.googleapis.com/maps/api/distancematrix/json' +
      '?origins=' + encodeURIComponent(origin) +
      '&destinations=' + encodeURIComponent(dest) +
      '&mode=driving&language=id&units=metric&key=' + CONFIG.GMAPS_API_KEY,
      { muteHttpExceptions: true, deadline: 15 }
    );
  } catch (e) {
    return { status: 'error', message: 'Tidak bisa menghitung jarak, coba lagi.' };
  }
  const d = JSON.parse(resp.getContentText());
  if (d.status !== 'OK') return { status: 'api_error', message: 'Maps error: ' + d.status };
  const el = d.rows[0].elements[0];
  if (el.status !== 'OK') return { status: 'not_found', message: 'Rute tidak ditemukan, coba kirim lokasi GPS.' };
  const km = el.distance.value / 1000;
  let biaya = 0;
  if (km > CONFIG.JEMPUT_MAX_KM) biaya = -1;
  else if (km <= 2) biaya = CONFIG.JEMPUT_MIN_BIAYA;
  else biaya = Math.ceil(km) * CONFIG.JEMPUT_RATE_PER_KM;
  return {
    status: 'ok',
    jarak_km: parseFloat(km.toFixed(1)),
    jarak_text: el.distance.text,
    durasi_menit: Math.ceil(el.duration.value / 60),
    dalam_radius: km <= CONFIG.JEMPUT_MAX_KM,
    biaya_jemput: biaya,
    biaya_text: 'Rp ' + biaya.toLocaleString('id-ID'),
    cabang_tujuan: cabang.nama,
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isCabangBuka(cabang) {
  const now = new Date();
  const hariMap = {'Monday':'Senin','Tuesday':'Selasa','Wednesday':'Rabu','Thursday':'Kamis','Friday':'Jumat','Saturday':'Sabtu','Sunday':'Minggu'};
  const hari = hariMap[Utilities.formatDate(now, CONFIG.TIMEZONE, 'EEEE')];
  if (!cabang.hari_buka.includes(hari)) return false;
  const hh = parseInt(Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH'));
  const mm = parseInt(Utilities.formatDate(now, CONFIG.TIMEZONE, 'mm'));
  const cur = hh*60+mm;
  const [bH,bM] = cabang.jam_buka.split(':').map(Number);
  const [tH,tM] = cabang.jam_tutup.split(':').map(Number);
  return cur >= bH*60+bM && cur < tH*60+tM;
}

function cariCabangTerdekat(originCoords, excludeCabangId) {
  const tersedia = getAllCabang().filter(c => c.aktif && c.id !== excludeCabangId && isCabangBuka(c));
  if (!tersedia.length) return { status: 'no_available', message: 'Tidak ada cabang lain yang buka' };
  const [lat, lng] = originCoords.split(',').map(parseFloat);
  if (isNaN(lat)||isNaN(lng)) return { status: 'error', message: 'Format koordinat tidak valid' };
  const sorted = tersedia
    .map(c => ({ ...c, jarak_km: parseFloat(haversineKm(lat, lng, c.koordinat_lat, c.koordinat_lng).toFixed(1)) }))
    .sort((a, b) => a.jarak_km - b.jarak_km);
  return { status: 'ok', cabang_sorted: sorted.map(c => ({ id:c.id, nama:c.nama, alamat:c.alamat, jarak_km:c.jarak_km, jam_tutup:c.jam_tutup })) };
}

// ── REMINDER & GHOSTING ──────────────────────────────────────

function sendDailyReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { status: 'skipped', reason: 'lock_busy' };
  try {
    const today = formatWIB(new Date(), 'yyyy-MM-dd');
    const sheet = getSheet(SHEETS.BOOKING);
    const data = sheet.getDataRange().getValues();
    let sent = 0;
    for (let i = 1; i < data.length && sent < 50; i++) {
      const row = data[i];
      if (String(row[COL.BOOKING.WAKTU_BOOKING]).split(' ')[0] !== today) continue;
      if (['batal','selesai'].includes(String(row[COL.BOOKING.STATUS_BOOKING]))) continue;
      if (row[COL.BOOKING.REMINDER_SENT] === true || row[COL.BOOKING.REMINDER_SENT] === 'TRUE') continue;
      const r = sendToAntigravity({
        type: 'SEND_REMINDER',
        nomor_wa: normalizePhone(String(row[COL.BOOKING.NOMOR_WA])),
        nama: row[COL.BOOKING.NAMA], nopol: row[COL.BOOKING.NOPOL],
        layanan: row[COL.BOOKING.LAYANAN], waktu_booking: row[COL.BOOKING.WAKTU_BOOKING],
        cabang: row[COL.BOOKING.CABANG], status_jemput: row[COL.BOOKING.STATUS_JEMPUT],
      });
      if (r.status === 'ok') {
        sheet.getRange(i + 1, COL.BOOKING.REMINDER_SENT + 1).setValue(true);
        sent++;
      }
      Utilities.sleep(500);
    }
    return { status: 'done', sent };
  } finally {
    lock.releaseLock();
  }
}

function checkGhostingPelanggan() {
  const now = new Date();
  const sheet = getSheet(SHEETS.BOOKING);
  const data = sheet.getDataRange().getValues();
  let processed = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.BOOKING.STATUS_BOOKING]) !== 'pending') continue;
    const jam = (now - new Date(data[i][COL.BOOKING.CREATED_AT])) / 3600000;
    const gSent = data[i][13]; // kolom N = ghosting_follow_sent
    if (jam >= 24 && !gSent) {
      sendToAntigravity({ type: 'GHOSTING_FOLLOWUP_1', nomor_wa: normalizePhone(String(data[i][COL.BOOKING.NOMOR_WA])), nama: data[i][COL.BOOKING.NAMA], booking_id: data[i][COL.BOOKING.ID] });
      sheet.getRange(i + 1, 14).setValue('SENT_1');
      processed++;
      Utilities.sleep(300);
    } else if (jam >= 48 && gSent === 'SENT_1') {
      sendToAntigravity({ type: 'GHOSTING_CLOSE_SESSION', nomor_wa: normalizePhone(String(data[i][COL.BOOKING.NOMOR_WA])), nama: data[i][COL.BOOKING.NAMA], booking_id: data[i][COL.BOOKING.ID] });
      sheet.getRange(i + 1, COL.BOOKING.STATUS_BOOKING + 1).setValue('batal');
      sheet.getRange(i + 1, 14).setValue('CLOSED');
      processed++;
      Utilities.sleep(300);
    }
  }
  return { status: 'done', processed };
}

// ── TRIGGER SETUP ────────────────────────────────────────────
// Jalankan fungsi ini SEKALI dari menu Run > setupAllTriggers

function setupAllTriggers() {
  // Hapus semua trigger lama dulu
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  // Trigger 1: Reminder harian jam 06:00 WIB
  ScriptApp.newTrigger('sendDailyReminders')
    .timeBased().atHour(6).everyDays(1).inTimezone('Asia/Jakarta').create();
  // Trigger 2: Cek ghosting tiap 6 jam
  ScriptApp.newTrigger('checkGhostingPelanggan')
    .timeBased().everyHours(6).create();
  Logger.log('Triggers berhasil dibuat: Reminder 06:00 + Ghosting tiap 6 jam');
  return { status: 'ok', triggers_created: 2 };
}

// ── TEST FUNCTION ─────────────────────────────────────────────
// Jalankan untuk verifikasi koneksi Sheets berfungsi

function testKoneksi() {
  try {
    const sheet = getSheet(SHEETS.PELANGGAN);
    const rows = sheet.getLastRow();
    Logger.log('Koneksi OK! Sheet Pelanggan ditemukan. Total baris: ' + rows);
    return { status: 'ok', sheet: 'Pelanggan', rows };
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
    return { status: 'error', message: e.message };
  }
}
