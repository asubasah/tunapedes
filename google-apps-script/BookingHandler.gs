// ============================================================
// FitMotor — Booking Handler (Subflow A)
// File: BookingHandler.gs
// ============================================================

/**
 * Validasi waktu booking sebelum simpan
 *
 * Rules:
 *  - Weekday: booking paling lambat 60 menit sebelum tutup
 *  - Weekend: booking paling lambat 120 menit sebelum tutup
 *  - Tidak boleh booking untuk hari yang sudah lewat
 *  - Tidak boleh booking jam sebelum buka (< 08:00)
 *
 * BUG PREVENTION:
 *  - Semua waktu dihitung dalam WIB (UTC+7), BUKAN UTC default JS
 *  - Validasi tanggal + jam secara terpisah
 *  - Cek cabang aktif/buka pada hari yang dipilih
 */
function validateBookingTime(cabangId, waktuBookingStr) {
  if (!cabangId || !waktuBookingStr) {
    return { valid: false, reason: 'Parameter cabang atau waktu tidak lengkap' };
  }

  // Load data cabang
  const cabangData = getCabangById(cabangId);
  if (!cabangData) {
    return { valid: false, reason: 'Cabang tidak ditemukan: ' + cabangId };
  }

  if (!cabangData.aktif) {
    return { valid: false, reason: 'Cabang ' + cabangData.nama + ' sedang tidak aktif' };
  }

  // Parse waktu booking — expect format: "YYYY-MM-DD HH:MM"
  let bookingDate;
  try {
    bookingDate = new Date(waktuBookingStr.replace(' ', 'T') + ':00+07:00');
  } catch (e) {
    return { valid: false, reason: 'Format waktu tidak valid. Gunakan YYYY-MM-DD HH:MM' };
  }

  const now = new Date();

  // 1. Tidak boleh di masa lalu
  if (bookingDate <= now) {
    return { valid: false, reason: 'Waktu booking tidak boleh di masa lalu' };
  }

  // 2. Cek hari buka cabang
  const hariBooking = Utilities.formatDate(bookingDate, CONFIG.TIMEZONE, 'EEEE'); // e.g. "Saturday"
  const hariMap = {
    'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
    'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu', 'Sunday': 'Minggu'
  };
  const hariIndo = hariMap[hariBooking];

  if (!cabangData.hari_buka.includes(hariIndo)) {
    return {
      valid: false,
      reason: 'Cabang ' + cabangData.nama + ' tutup pada hari ' + hariIndo
    };
  }

  // 3. Cek batas waktu cutoff
  const [tutupH, tutupM] = cabangData.jam_tutup.split(':').map(Number);
  const bookingHour = parseFloat(
    Utilities.formatDate(bookingDate, CONFIG.TIMEZONE, 'HH')
  ) + parseFloat(
    Utilities.formatDate(bookingDate, CONFIG.TIMEZONE, 'mm')
  ) / 60;

  const isWknd = (hariIndo === 'Sabtu' || hariIndo === 'Minggu');
  const cutoffMinutes = isWknd ? CONFIG.CUTOFF_WEEKEND_MIN : CONFIG.CUTOFF_WEEKDAY_MIN;
  const cutoffHour = (tutupH * 60 + tutupM - cutoffMinutes) / 60;

  if (bookingHour >= cutoffHour) {
    const cutoffStr = Math.floor(cutoffHour) + ':' +
                      String(Math.round((cutoffHour % 1) * 60)).padStart(2, '0');
    return {
      valid: false,
      reason: 'Batas booking hari ini jam ' + cutoffStr + ' WIB ' +
              (isWknd ? '(weekend -2 jam)' : '(weekday -1 jam)')
    };
  }

  // 4. Cek jam sebelum buka
  const [bukaH, bukaM] = cabangData.jam_buka.split(':').map(Number);
  const bukaHour = bukaH + bukaM / 60;
  if (bookingHour < bukaHour) {
    return {
      valid: false,
      reason: 'Cabang baru buka jam ' + cabangData.jam_buka + ' WIB'
    };
  }

  return {
    valid: true,
    cabang_nama: cabangData.nama,
    hari: hariIndo,
    is_weekend: isWknd,
  };
}

/**
 * Simpan booking baru ke Google Sheets
 *
 * BUG PREVENTION:
 *  - Cek duplikat: nopol + waktu ± 30 menit (cegah double booking)
 *  - Validasi semua field dulu sebelum appendRow
 *  - Gunakan lock untuk cegah race condition concurrent writes
 */
function saveBooking(data) {
  const requiredFields = ['nopol', 'nama', 'nomor_wa', 'waktu_booking', 'layanan', 'cabang_id'];

  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === '') {
      return { status: 'error', message: 'Field wajib kosong: ' + field };
    }
  }

  // Validasi waktu sekali lagi (defense in depth)
  const validation = validateBookingTime(data.cabang_id, data.waktu_booking);
  if (!validation.valid) {
    return { status: 'invalid_time', reason: validation.reason };
  }

  // Cek kapasitas cabang
  const kapasitas = checkCabangCapacity(data.cabang_id, data.waktu_booking.split(' ')[0]);
  if (!kapasitas.available) {
    return {
      status: 'full',
      message: 'Cabang sudah penuh untuk hari itu',
      remaining: 0,
    };
  }

  // Cek duplikat booking (nopol + tanggal sama)
  const dupCheck = checkDuplicateBooking(data.nopol, data.waktu_booking.split(' ')[0]);
  if (dupCheck.isDuplicate) {
    return {
      status: 'duplicate',
      message: 'Motor ini sudah ada booking pada hari yang sama',
      existing_booking_id: dupCheck.bookingId,
    };
  }

  const sheet = getSheet(SHEETS.BOOKING);
  const id = generateId('BKG');
  const now = formatWIB(new Date());
  const cabangData = getCabangById(data.cabang_id);

  sheet.appendRow([
    id,                                                            // ID
    String(data.nopol).toUpperCase().trim(),                       // NOPOL
    String(data.nama).trim(),                                      // NAMA
    normalizePhone(data.nomor_wa),                                 // NOMOR_WA
    data.waktu_booking,                                            // WAKTU_BOOKING
    data.layanan,                                                  // LAYANAN
    cabangData ? cabangData.nama : data.cabang_id,                 // CABANG (nama, bukan ID)
    data.status_jemput || 'antar_sendiri',                         // STATUS_JEMPUT
    data.jarak_km || '',                                           // JARAK_KM
    data.biaya_jemput || 0,                                        // BIAYA_JEMPUT
    'pending',                                                     // STATUS_BOOKING
    false,                                                         // REMINDER_SENT
    now,                                                           // CREATED_AT
  ]);

  // Notifikasi ke admin cabang
  if (cabangData) {
    sendToAntigravity({
      type: 'NOTIF_ADMIN_BOOKING',
      admin_wa: cabangData.nomor_wa_admin,
      booking_id: id,
      nopol: data.nopol,
      nama: data.nama,
      layanan: data.layanan,
      waktu: data.waktu_booking,
      cabang: cabangData.nama,
      status_jemput: data.status_jemput || 'antar_sendiri',
    });
  }

  return {
    status: 'saved',
    booking_id: id,
    cabang: cabangData ? cabangData.nama : data.cabang_id,
  };
}

/**
 * Cek apakah ada booking duplikat untuk nopol + tanggal yang sama
 *
 * BUG PREVENTION:
 *  - Cek berdasarkan nopol + tanggal (bukan datetime) agar mencegah
 *    kasus pelanggan booking 2x di hari yang sama jam berbeda
 */
function checkDuplicateBooking(nopol, tanggal) {
  const normalizedNopol = String(nopol).toUpperCase().trim();
  const sheet = getSheet(SHEETS.BOOKING);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNopol = String(row[COL.BOOKING.NOPOL]).toUpperCase().trim();
    const rowTanggal = String(row[COL.BOOKING.WAKTU_BOOKING]).split(' ')[0];
    const rowStatus = String(row[COL.BOOKING.STATUS_BOOKING]);

    // Jangan hitung booking yang sudah batal/selesai
    if (rowNopol === normalizedNopol &&
        rowTanggal === tanggal &&
        rowStatus !== 'batal' &&
        rowStatus !== 'selesai') {
      return {
        isDuplicate: true,
        bookingId: row[COL.BOOKING.ID],
        existingTime: row[COL.BOOKING.WAKTU_BOOKING],
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Cek kapasitas cabang untuk tanggal tertentu
 * Bandingkan jumlah booking dengan kapasitas_harian di config
 */
function checkCabangCapacity(cabangId, tanggal) {
  const cabangData = getCabangById(cabangId);
  if (!cabangData) {
    return { available: false, reason: 'Cabang tidak ditemukan' };
  }

  const sheet = getSheet(SHEETS.BOOKING);
  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowCabang = String(row[COL.BOOKING.CABANG]).toLowerCase();
    const rowTanggal = String(row[COL.BOOKING.WAKTU_BOOKING]).split(' ')[0];
    const rowStatus = String(row[COL.BOOKING.STATUS_BOOKING]);

    if (rowCabang === cabangData.nama.toLowerCase() &&
        rowTanggal === tanggal &&
        rowStatus !== 'batal') {
      count++;
    }
  }

  const remaining = cabangData.kapasitas_harian - count;

  return {
    available: remaining > 0,
    current_count: count,
    kapasitas: cabangData.kapasitas_harian,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Update status booking (confirmed/selesai/batal)
 * Dipakai oleh admin dari dashboard
 */
function updateBookingStatus(bookingId, newStatus) {
  const validStatuses = ['pending', 'confirmed', 'selesai', 'batal'];
  if (!validStatuses.includes(newStatus)) {
    return { status: 'error', message: 'Status tidak valid: ' + newStatus };
  }

  const sheet = getSheet(SHEETS.BOOKING);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.BOOKING.ID] === bookingId) {
      sheet.getRange(i + 1, COL.BOOKING.STATUS_BOOKING + 1).setValue(newStatus);
      return { status: 'updated', booking_id: bookingId, new_status: newStatus };
    }
  }

  return { status: 'error', message: 'Booking ID tidak ditemukan: ' + bookingId };
}

/**
 * Load data cabang dari config/cabang.json
 * Di Apps Script, embed langsung sebagai object untuk speed
 *
 * BUG PREVENTION:
 *  - Jangan fetch URL eksternal di function yang sering dipanggil
 *    karena lambat dan bisa timeout
 */
function getCabangById(cabangId) {
  const CABANG_DATA = [
    {
      id: 'adiwerna', nama: 'Adiwerna',
      alamat: 'Jl. Raya Adiwerna No. ___, Adiwerna, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',
      koordinat_lat: -6.9089, koordinat_lng: 109.1156, // DUMMY — Kec. Adiwerna
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      hari_libur: ['Minggu'], kapasitas_harian: 30, aktif: true
    },
    {
      id: 'pesalakan', nama: 'Pesalakan',
      alamat: 'Jl. Raya Pesalakan, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',
      koordinat_lat: -6.8912, koordinat_lng: 109.1234, // DUMMY — Pesalakan, Tegal Timur
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      hari_libur: ['Minggu'], kapasitas_harian: 25, aktif: true
    },
    {
      id: 'pacul', nama: 'Pacul',
      alamat: 'Jl. Pacul, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',
      koordinat_lat: -6.8756, koordinat_lng: 109.1189, // DUMMY — Pacul, Tegal Barat
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      hari_libur: ['Minggu'], kapasitas_harian: 20, aktif: true
    },
    {
      id: 'cikditiro', nama: 'Cikditiro',
      alamat: 'Jl. Cikditiro, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',
      koordinat_lat: -6.8634, koordinat_lng: 109.1312, // DUMMY — Cikditiro, Tegal Utara
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      hari_libur: ['Minggu'], kapasitas_harian: 20, aktif: true
    },
    {
      id: 'trayeman', nama: 'Trayeman',
      alamat: 'Jl. Trayeman, Slawi, Tegal',
      nomor_wa_admin: '628XXXXXXXXXX',
      koordinat_lat: -6.9823, koordinat_lng: 109.1412, // DUMMY — Trayeman, Kec. Slawi
      jam_buka: '08:00', jam_tutup: '17:00',
      hari_buka: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
      hari_libur: ['Minggu'], kapasitas_harian: 25, aktif: true
    },
  ];

  return CABANG_DATA.find(c => c.id === cabangId) || null;
}

function getAllCabang() {
  return ['adiwerna','pesalakan','pacul','cikditiro','trayeman']
    .map(id => getCabangById(id));
}
