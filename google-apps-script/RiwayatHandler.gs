// ============================================================
// FitMotor — Riwayat Servis Handler (Subflow D)
// File: RiwayatHandler.gs
// ============================================================

/**
 * Ambil riwayat servis berdasarkan nopol
 *
 * BUG PREVENTION:
 *  - Normalisasi nopol: uppercase, trim, normalize spasi
 *  - Return semua riwayat, diurutkan dari terbaru
 *  - Batasi return maksimal 5 entri terbaru (cegah pesan terlalu panjang di WA)
 */
function getRiwayatServis(nopol) {
  if (!nopol || String(nopol).trim() === '') {
    return { status: 'error', message: 'Nopol tidak boleh kosong' };
  }

  const normalizedNopol = String(nopol).toUpperCase().replace(/\s+/g, ' ').trim();
  const sheet = getSheet(SHEETS.RIWAYAT_SERVIS);
  const data = sheet.getDataRange().getValues();

  const riwayat = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNopol = String(row[COL.RIWAYAT.NOPOL]).toUpperCase().replace(/\s+/g, ' ').trim();

    if (rowNopol === normalizedNopol) {
      riwayat.push({
        tanggal: row[COL.RIWAYAT.TANGGAL],
        jenis_servis: row[COL.RIWAYAT.JENIS_SERVIS],
        oli: row[COL.RIWAYAT.OLI] || '-',
        kilometer: row[COL.RIWAYAT.KILOMETER] || '-',
        cabang: row[COL.RIWAYAT.CABANG],
        teknisi: row[COL.RIWAYAT.TEKNISI] || '-',
        catatan: row[COL.RIWAYAT.CATATAN] || '',
      });
    }
  }

  if (riwayat.length === 0) {
    return {
      status: 'not_found',
      nopol: normalizedNopol,
      message: 'Belum ada riwayat servis untuk nopol ' + normalizedNopol,
    };
  }

  // Sort terbaru dulu (asumsi tanggal format YYYY-MM-DD atau Date object)
  riwayat.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  return {
    status: 'found',
    nopol: normalizedNopol,
    total: riwayat.length,
    riwayat: riwayat.slice(0, 5), // Maks 5 terbaru
  };
}

/**
 * Tambah riwayat servis baru (dipanggil setelah servis selesai)
 * Bisa dipanggil dari admin dashboard atau sistem internal
 */
function addRiwayatServis(data) {
  const requiredFields = ['nopol', 'jenis_servis', 'cabang'];

  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === '') {
      return { status: 'error', message: 'Field wajib kosong: ' + field };
    }
  }

  const sheet = getSheet(SHEETS.RIWAYAT_SERVIS);
  const tanggal = data.tanggal || formatWIB(new Date(), 'yyyy-MM-dd');

  sheet.appendRow([
    String(data.nopol).toUpperCase().trim(),
    tanggal,
    data.jenis_servis,
    data.oli || '',
    data.kilometer || '',
    data.cabang,
    data.teknisi || '',
    data.catatan || '',
  ]);

  // Update status booking jika ada booking_id
  if (data.booking_id) {
    updateBookingStatus(data.booking_id, 'selesai');
  }

  return {
    status: 'added',
    nopol: data.nopol,
    tanggal,
    jenis_servis: data.jenis_servis,
  };
}

/**
 * Format riwayat servis menjadi teks siap kirim ke WA
 * Digunakan oleh Antigravity untuk render pesan
 */
function formatRiwayatToText(riwayatResult) {
  if (riwayatResult.status === 'not_found') {
    return '🔍 Nopol *' + riwayatResult.nopol + '* belum memiliki riwayat servis di Fit Motor.\n\n' +
           'Mau kami daftarkan sekarang?';
  }

  const lines = ['📋 *Riwayat Servis Motor ' + riwayatResult.nopol + '*\n'];

  riwayatResult.riwayat.forEach((r, idx) => {
    lines.push('*' + (idx + 1) + '. ' + r.tanggal + '*');
    lines.push('   🔧 ' + r.jenis_servis);
    lines.push('   🛢️ Oli: ' + r.oli);
    if (r.kilometer !== '-') lines.push('   📏 KM: ' + r.kilometer);
    lines.push('   📍 Cabang: ' + r.cabang);
    if (r.catatan) lines.push('   📝 ' + r.catatan);
    lines.push('');
  });

  if (riwayatResult.total > 5) {
    lines.push('_...dan ' + (riwayatResult.total - 5) + ' riwayat lainnya_');
  }

  return lines.join('\n');
}
