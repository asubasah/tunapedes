// ============================================================
// FitMotor — Jemput Antar Handler (Subflow B)
// File: JemputHandler.gs
// ============================================================

/**
 * Kalkulasi jarak dari lokasi pelanggan ke cabang
 * Menggunakan Google Maps Distance Matrix API
 *
 * BUG PREVENTION:
 *  - Validasi format input: bisa berupa koordinat "lat,lng"
 *    atau nama alamat (kedua format didukung)
 *  - Handle API quota exceeded (error 429) dengan graceful fallback
 *  - Handle "ZERO_RESULTS" (alamat tidak ditemukan)
 *  - Timeout handling jika API lambat
 *  - Jangan expose API key di response
 */
function calculateJarak(originInput, cabangId) {
  if (!originInput) {
    return { status: 'error', message: 'Lokasi asal tidak boleh kosong' };
  }

  if (!cabangId) {
    return { status: 'error', message: 'Cabang ID tidak boleh kosong' };
  }

  const cabang = getCabangById(cabangId);
  if (!cabang) {
    return { status: 'error', message: 'Cabang tidak ditemukan: ' + cabangId };
  }

  // Sanitasi origin: jika dari WA location share, format adalah "lat,lng"
  // Jika teks alamat, encode agar aman di URL
  const origin = sanitizeLocationInput(originInput);
  if (!origin) {
    return {
      status: 'error',
      message: 'Format lokasi tidak valid. Silakan kirim lokasi GPS atau ketik alamat lengkap.'
    };
  }

  const destination = cabang.koordinat_lat + ',' + cabang.koordinat_lng;

  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json' +
    '?origins=' + encodeURIComponent(origin) +
    '&destinations=' + encodeURIComponent(destination) +
    '&mode=driving' +
    '&language=id' +
    '&units=metric' +
    '&key=' + CONFIG.GMAPS_API_KEY;

  let response, responseData;

  try {
    response = UrlFetchApp.fetch(url, {
      method: 'GET',
      muteHttpExceptions: true,
      deadline: 15, // 15 detik timeout
    });
  } catch (e) {
    logError('calculateJarak', 'UrlFetch failed: ' + e.message, { origin, cabangId });
    return {
      status: 'error',
      message: 'Tidak bisa menghitung jarak saat ini. Silakan coba lagi atau hubungi admin.'
    };
  }

  try {
    responseData = JSON.parse(response.getContentText());
  } catch (e) {
    logError('calculateJarak', 'JSON parse error', response.getContentText());
    return { status: 'error', message: 'Respons API tidak valid' };
  }

  // Cek status response
  if (responseData.status !== 'OK') {
    const errorMsg = {
      'INVALID_REQUEST': 'Format lokasi tidak dikenali',
      'MAX_ELEMENTS_EXCEEDED': 'Terlalu banyak request sekaligus',
      'OVER_DAILY_LIMIT': 'Kuota API Maps hari ini sudah habis',
      'OVER_QUERY_LIMIT': 'Terlalu banyak request, coba lagi sesaat',
      'REQUEST_DENIED': 'API Key tidak valid',
      'UNKNOWN_ERROR': 'Error tidak diketahui dari server Maps',
    };
    const msg = errorMsg[responseData.status] || 'Error API Maps: ' + responseData.status;
    logError('calculateJarak', msg, responseData);
    return { status: 'api_error', message: msg };
  }

  const element = responseData.rows[0].elements[0];

  if (element.status !== 'OK') {
    if (element.status === 'ZERO_RESULTS') {
      return {
        status: 'not_found',
        message: 'Rute tidak ditemukan. Pastikan alamat Anda benar dan bisa diakses kendaraan.'
      };
    }
    return { status: 'error', message: 'Element status: ' + element.status };
  }

  const distanceMeters = element.distance.value;
  const distanceKm = distanceMeters / 1000;
  const durasiDetik = element.duration.value;

  // Kalkulasi biaya
  const biaya = hitungBiayaJemput(distanceKm);

  return {
    status: 'ok',
    jarak_km: parseFloat(distanceKm.toFixed(1)),
    jarak_text: element.distance.text,
    durasi_menit: Math.ceil(durasiDetik / 60),
    cabang_tujuan: cabang.nama,
    dalam_radius: distanceKm <= CONFIG.JEMPUT_MAX_KM,
    biaya_jemput: biaya,
    biaya_text: 'Rp ' + biaya.toLocaleString('id-ID'),
  };
}

/**
 * Hitung biaya jemput antar berdasarkan jarak
 *
 * Tier:
 *  ≤ 2 km  → biaya minimum Rp 6.000
 *  2–7 km  → Rp 3.000/km (dibulatkan ke atas)
 *  > 7 km  → diluar radius, kembalikan -1
 */
function hitungBiayaJemput(distanceKm) {
  if (distanceKm > CONFIG.JEMPUT_MAX_KM) {
    return -1; // Signal: di luar radius
  }

  if (distanceKm <= 2) {
    return CONFIG.JEMPUT_MIN_BIAYA; // Flat minimum
  }

  // Per km dibulatkan ke atas
  return Math.ceil(distanceKm) * CONFIG.JEMPUT_RATE_PER_KM;
}

/**
 * Sanitasi dan validasi input lokasi dari pelanggan
 * WA Location Share format: "-6.9123,109.1234" atau link maps
 *
 * BUG PREVENTION:
 *  - Cegah injection ke URL parameter
 *  - Validasi koordinat range yang masuk akal untuk Indonesia
 */
function sanitizeLocationInput(input) {
  if (!input) return null;

  const str = String(input).trim();

  // Cek apakah format koordinat: "-6.xxx,109.xxx"
  const coordPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
  const match = str.match(coordPattern);

  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    // Validasi range Indonesia: lat -11 to 6, lng 95 to 141
    if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
      return lat + ',' + lng;
    }
    // Koordinat di luar Indonesia
    return null;
  }

  // Jika bukan koordinat, anggap alamat teks
  // Pastikan panjang wajar dan tidak ada karakter berbahaya
  if (str.length < 5 || str.length > 200) {
    return null;
  }

  // Hilangkan karakter yang tidak relevan untuk alamat
  const cleaned = str.replace(/[<>{}|\\^`]/g, '');
  return cleaned;
}

/**
 * Cari cabang terdekat dari lokasi pelanggan
 * Digunakan di Subflow F (Pengalihan Cabang)
 *
 * BUG PREVENTION:
 *  - Filter cabang yang sedang buka dulu
 *  - Gunakan Haversine formula (offline) sebagai fallback jika API error
 *    agar sistem tidak terhenti total
 */
function cariCabangTerdekat(originCoords, excludeCabangId) {
  const semuaCabang = getAllCabang().filter(c => {
    if (!c.aktif) return false;
    if (c.id === excludeCabangId) return false;
    return isCabangBuka(c);
  });

  if (semuaCabang.length === 0) {
    return { status: 'no_available', message: 'Tidak ada cabang lain yang buka' };
  }

  // Hitung jarak ke semua cabang aktif menggunakan Haversine (tanpa API call)
  const [lat, lng] = originCoords.split(',').map(parseFloat);
  if (isNaN(lat) || isNaN(lng)) {
    return { status: 'error', message: 'Format koordinat asal tidak valid' };
  }

  const withDistance = semuaCabang.map(cabang => ({
    ...cabang,
    jarak_km: haversineKm(lat, lng, cabang.koordinat_lat, cabang.koordinat_lng),
  }));

  withDistance.sort((a, b) => a.jarak_km - b.jarak_km);

  return {
    status: 'ok',
    cabang_sorted: withDistance.map(c => ({
      id: c.id,
      nama: c.nama,
      alamat: c.alamat,
      jarak_km: parseFloat(c.jarak_km.toFixed(1)),
      jam_tutup: c.jam_tutup,
    })),
  };
}

/**
 * Cek apakah cabang sedang buka sekarang (WIB)
 */
function isCabangBuka(cabang) {
  const now = new Date();
  const hariIndo = {
    'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
    'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu', 'Sunday': 'Minggu'
  }[Utilities.formatDate(now, CONFIG.TIMEZONE, 'EEEE')];

  if (!cabang.hari_buka.includes(hariIndo)) return false;

  const currentHH = parseInt(Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH'));
  const currentMM = parseInt(Utilities.formatDate(now, CONFIG.TIMEZONE, 'mm'));
  const currentTotal = currentHH * 60 + currentMM;

  const [bukaH, bukaM] = cabang.jam_buka.split(':').map(Number);
  const [tutupH, tutupM] = cabang.jam_tutup.split(':').map(Number);

  return currentTotal >= (bukaH * 60 + bukaM) && currentTotal < (tutupH * 60 + tutupM);
}

/**
 * Haversine formula — hitung jarak lurus antar 2 koordinat (km)
 * Digunakan sebagai fallback offline tanpa API call
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius bumi km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
