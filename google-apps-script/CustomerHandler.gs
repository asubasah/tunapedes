// ============================================================
// FitMotor — Customer / Pelanggan Handler
// File: CustomerHandler.gs
// ============================================================

/**
 * Lookup pelanggan berdasarkan nomor WA
 *
 * BUG PREVENTION:
 *  - Normalisasi nomor WA sebelum cari (hilangkan +, spasi, dash)
 *  - Return null bukan throw jika tidak ditemukan (bukan error)
 */
function lookupPelanggan(nomorWa) {
  if (!nomorWa) {
    return { status: 'error', message: 'Nomor WA tidak boleh kosong' };
  }

  const normalized = normalizePhone(nomorWa);
  const sheet = getSheet(SHEETS.PELANGGAN);
  const data = sheet.getDataRange().getValues();

  // Skip row 0 (header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowPhone = normalizePhone(String(row[COL.PELANGGAN.NOMOR_WA]));

    if (rowPhone === normalized) {
      return {
        status: 'found',
        row_index: i + 1, // 1-indexed untuk sheet operations
        id_pelanggan: row[COL.PELANGGAN.ID],
        nama: row[COL.PELANGGAN.NAMA],
        nomor_wa: row[COL.PELANGGAN.NOMOR_WA],
        motor: row[COL.PELANGGAN.MOTOR],
        nopol: row[COL.PELANGGAN.NOPOL],
        pernah_jemput: row[COL.PELANGGAN.PERNAH_JEMPUT] === true,
        alamat_jemput_terakhir: row[COL.PELANGGAN.ALAMAT_JEMPUT_TERAKHIR] || '',
        cabang_default: row[COL.PELANGGAN.CABANG_DEFAULT] || '',
        is_non_ai: row[COL.PELANGGAN.IS_NON_AI] === true,
      };
    }
  }

  return { status: 'not_found', nomor_wa: normalized };
}

/**
 * Lookup pelanggan berdasarkan Nopol
 * Dipakai di Subflow D (History) dan Subflow A (Booking)
 */
function lookupPelangganByNopol(nopol) {
  if (!nopol) {
    return { status: 'error', message: 'Nopol tidak boleh kosong' };
  }

  // Normalisasi nopol: uppercase, hilangkan spasi berlebih
  const normalizedNopol = nopol.toUpperCase().replace(/\s+/g, ' ').trim();
  const sheet = getSheet(SHEETS.PELANGGAN);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNopol = String(row[COL.PELANGGAN.NOPOL]).toUpperCase().replace(/\s+/g, ' ').trim();
    if (rowNopol === normalizedNopol) {
      return {
        status: 'found',
        row_index: i + 1,
        nama: row[COL.PELANGGAN.NAMA],
        nomor_wa: row[COL.PELANGGAN.NOMOR_WA],
        motor: row[COL.PELANGGAN.MOTOR],
        nopol: row[COL.PELANGGAN.NOPOL],
      };
    }
  }

  return { status: 'not_found', nopol: normalizedNopol };
}

/**
 * Daftarkan pelanggan baru
 *
 * BUG PREVENTION:
 *  - Cek duplikat nomor WA sebelum tambah
 *  - Validasi semua field wajib
 */
function registerPelangganBaru(data) {
  const requiredFields = ['nama', 'nomor_wa', 'motor', 'nopol'];

  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === '') {
      return { status: 'error', message: 'Field wajib kosong: ' + field };
    }
  }

  // Cek duplikat
  const existing = lookupPelanggan(data.nomor_wa);
  if (existing.status === 'found') {
    return {
      status: 'duplicate',
      message: 'Pelanggan sudah terdaftar',
      pelanggan: existing,
    };
  }

  const sheet = getSheet(SHEETS.PELANGGAN);
  const id = generateId('PLG');
  const now = formatWIB(new Date());

  sheet.appendRow([
    id,
    String(data.nama).trim(),
    normalizePhone(data.nomor_wa),
    String(data.motor).trim(),
    String(data.nopol).toUpperCase().trim(),
    false,           // pernah_jemput
    '',              // alamat_jemput_terakhir
    data.cabang_default || '',
    false,           // is_non_ai
    now,             // tanggal_daftar
  ]);

  return {
    status: 'registered',
    id_pelanggan: id,
    nama: data.nama,
    nomor_wa: data.nomor_wa,
  };
}

/**
 * Update data jemput setelah berhasil booking jemput antar
 * Simpan alamat terakhir untuk kemudahan re-use
 */
function updateJemputData(nomorWa, alamat) {
  if (!nomorWa || !alamat) {
    return { status: 'error', message: 'Parameter tidak lengkap' };
  }

  const pelanggan = lookupPelanggan(nomorWa);
  if (pelanggan.status !== 'found') {
    return { status: 'error', message: 'Pelanggan tidak ditemukan' };
  }

  const sheet = getSheet(SHEETS.PELANGGAN);
  const rowIndex = pelanggan.row_index;

  // Update kolom pernah_jemput (F) dan alamat_jemput_terakhir (G)
  sheet.getRange(rowIndex, COL.PELANGGAN.PERNAH_JEMPUT + 1).setValue(true);
  sheet.getRange(rowIndex, COL.PELANGGAN.ALAMAT_JEMPUT_TERAKHIR + 1).setValue(alamat);

  return { status: 'updated', row_index: rowIndex };
}

/**
 * Cek dan tambah ke Non-AI List
 */
function checkNonAiList(nomorWa) {
  if (!nomorWa) {
    return { status: 'error', message: 'Nomor WA diperlukan' };
  }

  const normalized = normalizePhone(nomorWa);
  const sheet = getSheet(SHEETS.NON_AI_LIST);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowPhone = normalizePhone(String(data[i][COL.NON_AI.NOMOR_WA]));
    if (rowPhone === normalized) {
      return {
        status: 'found',
        is_non_ai: true,
        nama: data[i][COL.NON_AI.NAMA],
        alasan: data[i][COL.NON_AI.ALASAN],
      };
    }
  }

  return { status: 'not_found', is_non_ai: false };
}

function addToNonAiList(data) {
  if (!data.nomor_wa || !data.nama) {
    return { status: 'error', message: 'nomor_wa dan nama wajib diisi' };
  }

  // Cek duplikat dulu
  const existing = checkNonAiList(data.nomor_wa);
  if (existing.is_non_ai) {
    return { status: 'duplicate', message: 'Nomor sudah ada di Non-AI List' };
  }

  const sheet = getSheet(SHEETS.NON_AI_LIST);
  sheet.appendRow([
    normalizePhone(data.nomor_wa),
    data.nama,
    data.alasan || 'VIP',
    data.added_by || 'Admin',
    formatWIB(new Date()),
  ]);

  return { status: 'added' };
}

/**
 * Normalisasi nomor WA ke format 628xxxxxxxxx
 * Menangani: +628xx, 08xx, 628xx, (628)xx, spasi, strip
 *
 * BUG PREVENTION:
 *  - Selalu normalize sebelum compare/store agar tidak ada mismatch
 */
function normalizePhone(phone) {
  if (!phone) return '';

  // Hilangkan semua karakter non-digit
  let digits = String(phone).replace(/\D/g, '');

  // Handle prefix 0 → 62
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  }

  // Jika tidak dimulai 62, tambahkan
  if (!digits.startsWith('62')) {
    digits = '62' + digits;
  }

  return digits;
}
