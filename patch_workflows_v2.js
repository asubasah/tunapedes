/**
 * FITMOTOR — Master Workflow Patcher v2
 * 
 * Perubahan:
 * 01_main_router.json:
 *   - Extract: tambah field `cabang_id` dari parsing device_id
 *   - Route: sertakan `cabang_id` di payload ke child flows  
 *   - CS_Agent system prompt: tambah info cabang + nomor WA untuk referral
 *   - Cek Sesi Aktif: escape keyword (sudah patch sebelumnya, verify ulang)
 * 
 * 02_booking_flow.json:
 *   - Ollama: Ekstrak Data — hapus cabang_id dari field diminta, pre-fill dari webhook
 *   - Code: Parse Ekstrak — pre-fill cabang_id dari webhook body
 *   - IF: Data Lengkap? — hapus syarat cabang_id
 *   - GoWA: Minta Data — hapus baris "Di Cabang mana?"
 *   - Ganti node Cek Duplikat lama → Cek Nopol Aktif (anti lintas-cabang)
 *   - Tambah GoWA notif nopol terdaftar di cabang lain
 *   - MySQL: Insert Booking — cabang_id dari webhook bukan dari AI
 */

const fs = require('fs');

// =============================================
// 01_main_router.json patches
// =============================================
function patch01(data) {
  data.nodes.forEach(n => {
    
    // 1. Extract: nomor_wa & pesan — tambah field cabang_id
    if (n.name === 'Extract: nomor_wa & pesan') {
      const assignments = n.parameters.assignments.assignments;
      // Hapus jika sudah ada (idempoten)
      const existing = assignments.findIndex(a => a.id === 'cabang_id');
      if (existing !== -1) assignments.splice(existing, 1);
      
      assignments.push({
        id: 'cabang_id',
        name: 'cabang_id',
        // device_id format: "fitmotor_adiwerna" → "adiwerna"
        value: "={{ $json.body.device_id ? $json.body.device_id.replace('fitmotor_', '') : '' }}",
        type: 'string'
      });
    }
    
    // 2. Route: Booking Flow — sertakan cabang_id
    if (n.name === 'Route: Booking Flow') {
      n.parameters.jsonBody = `={{ { "nomor_wa": $('Extract: nomor_wa & pesan').item.json.nomor_wa, "pesan": $('Extract: nomor_wa & pesan').item.json.pesan, "nama_pelanggan": $('Set: Pelanggan Context').item.json.nama_pelanggan, "motor": $('Set: Pelanggan Context').item.json.motor, "nopol": $('Set: Pelanggan Context').item.json.nopol, "device_id": $('Extract: nomor_wa & pesan').item.json.device_id, "cabang_id": $('Extract: nomor_wa & pesan').item.json.cabang_id } }}`;
    }
    
    // 3. Route: Jemput Antar Flow — sertakan cabang_id
    if (n.name === 'Route: Jemput Antar Flow') {
      n.parameters.jsonBody = `={{ { "nomor_wa": $('Extract: nomor_wa & pesan').item.json.nomor_wa, "pesan": $('Extract: nomor_wa & pesan').item.json.pesan, "nama_pelanggan": $('Set: Pelanggan Context').item.json.nama_pelanggan, "motor": $('Set: Pelanggan Context').item.json.motor, "nopol": $('Set: Pelanggan Context').item.json.nopol, "device_id": $('Extract: nomor_wa & pesan').item.json.device_id, "cabang_id": $('Extract: nomor_wa & pesan').item.json.cabang_id } }}`;
    }
    
    // 4. CS_Agent system prompt — tambah info semua cabang + referral
    if (n.name === 'CS_Agent') {
      n.parameters.options.system = `Anda adalah Customer Service dari bengkel motor Fit Motor Tegal.
Jawab pertanyaan pelanggan dengan sopan, ramah (bahasa sehari-hari), dan SANGAT SINGKAT (maksimal 2-3 kalimat).

INFO BENGKEL:
- Jam Buka: Senin s/d Sabtu (08:00 – 17:00 WIB). Hari Minggu/Libur TUTUP.
- Syarat: HANYA terima motor Injeksi tahun 2010 ke atas. TIDAK TERIMA motor Karburator/2-Tak!
- Layanan Jemput: Max jarak 7 km. (biaya mulai Rp 6.000 radius 2km).
- Antrian prioritas untuk pelanggan yang booking/daftar terlebih dahulu.

DAFTAR CABANG & NOMOR WA MASING-MASING:
- Adiwerna  (Jl. Raya Adiwerna, Tegal)  → 0855-0994-1624
- Cikditiro (Jl. Cikditiro, Tegal)       → 0811-3438-800
- Pacul     (Jl. Pacul, Tegal)           → 0831-1610-5550
- Pesalakan (Jl. Raya Pesalakan, Tegal)  → (segera hadir)
- Trayeman  (Jl. Trayeman, Slawi, Tegal) → (segera hadir)

ATURAN PENTING:
- Jika pelanggan sedang WA ke satu cabang tapi minta pindah ke cabang lain karena kejauhan, berikan nomor WA cabang yang lebih dekat dari daftar di atas.
- Jika ada estimasi biaya atau hal yang tidak ada di panduan ini, suruh datang langsung agar dicek mekanik.
- Jika hanya disapa "halo/pagi", balas salam lalu tawarkan "Ada kendala apa dengan motornya Kak? Kami siap bantu!"`;
    }
    
    // 5. Cek Sesi Aktif — pastikan escape keyword sudah benar
    if (n.name === 'Cek Sesi Aktif') {
      n.parameters.query = `SELECT step_aktif, context_json 
FROM sesi_chat 
WHERE nomor_wa = '{{ $('Extract: nomor_wa & pesan').item.json.nomor_wa }}' 
AND status = 'aktif' 
AND last_activity > DATE_SUB(NOW(), INTERVAL 1 HOUR)
AND '{{ $('Extract: nomor_wa & pesan').item.json.pesan }}' NOT REGEXP '(?i)(tanya|nanya|jam|buka|tutup|libur|batal|cancel|kembali|halo|hallo|allo|hai|hi|pagi|siang|malam|lokasi|alamat|harga|biaya|tarif|pindah)'
LIMIT 1;`;
    }
  });
  return data;
}

// =============================================
// 02_booking_flow.json patches  
// =============================================
function patch02(data) {
  // Kumpulkan node baru yang akan ditambahkan
  const newNodes = [];
  const newConnections = {};
  
  data.nodes.forEach(n => {
    
    // 1. Ollama: Ekstrak Data — hapus cabang_id dari instruksi AI
    //    AI hanya perlu mengekstrak: layanan, motor, nopol, waktu
    //    cabang_id sudah otomatis dari device_id
    if (n.name === 'Ollama: Ekstrak Data') {
      n.parameters.messages.messageValues[0].message = `=Anda adalah AI bengkel Fit Motor. Ekstrak data servis dari kalimat pelanggan.
Gabungkan dengan 'Data Sesi Sebelumnya' jika ada.

FORMAT WAKTU WAJIB: YYYY-MM-DD HH:mm:00 (Jika disebut besok, tambah 1 hari dari Waktu Saat Ini. Jika tanpa jam, default 09:00:00).

JANGAN tanya tentang cabang — cabang sudah otomatis terdeteksi dari nomor WA yang dihubungi pelanggan.

Balas HANYA JSON murni (Tanpa awalan markdown blok).
Contoh output (jangan ubah key):
{
  "layanan": "",
  "motor": "",
  "waktu": "",
  "nopol": ""
}`;
    }
    
    // 2. Gemini: Ekstrak Data Booking (code node) — pre-fill cabang_id dari webhook
    if (n.name === 'Gemini: Ekstrak Data Booking') {
      n.parameters.jsCode = `let text = $input.item.json.text || $input.item.json.content || '{}';
text = text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim();
let bongkar = {};
try {
  bongkar = JSON.parse(text);
} catch(e) {}

// cabang_id SELALU diambil dari webhook (device_id), bukan dari AI
const cabang_from_device = $('Webhook (From Main Router)').item.json.body.cabang_id || 
                           ($('Webhook (From Main Router)').item.json.body.device_id || '').replace('fitmotor_', '');

return [{ json: {
  layanan: bongkar.layanan || '',
  motor: bongkar.motor || '',
  nopol: bongkar.nopol || '',
  waktu: bongkar.waktu || '',
  cabang_id: cabang_from_device,
  alamat_jemput: bongkar.alamat_jemput || ''
} }];`;
    }
    
    // 3. IF: Data Lengkap? — hapus syarat cabang_id (sudah auto)
    //    Hanya cek: layanan, motor, waktu, nopol
    if (n.name === 'IF: Data Lengkap?') {
      n.parameters.conditions.conditions = [
        { id: 'c1', leftValue: '={{ $json.layanan }}', operator: { type: 'string', operation: 'notEmpty' } },
        { id: 'c2', leftValue: '={{ $json.motor }}',   operator: { type: 'string', operation: 'notEmpty' } },
        { id: 'c3', leftValue: '={{ $json.waktu }}',   operator: { type: 'string', operation: 'notEmpty' } },
        { id: 'c5', leftValue: '={{ $json.nopol }}',   operator: { type: 'string', operation: 'notEmpty' } }
      ];
    }
    
    // 4. GoWA: Minta Data — hapus pertanyaan "Di Cabang mana?"
    if (n.name === 'GoWA: Minta Data') {
      n.parameters.message = `={{ 'Halo kak! Untuk booking servis di Cabang ' + ($('Webhook (From Main Router)').item.json.body.cabang_id || '').charAt(0).toUpperCase() + ($('Webhook (From Main Router)').item.json.body.cabang_id || '').slice(1) + ', mohon bantu melengkapi data berikut ya:\\n\\n' + ($json.motor ? '' : '- Motor apa?\\n') + ($json.nopol ? '' : '- Plat nomor berapa?\\n') + ($json.layanan ? '' : '- Mau servis apa?\\n') + ($json.waktu ? '' : '- Ingin datang kapan?\\n') }}`;
    }
    
    // 5. MySQL: Cek Duplikat Booking (lama) → Ganti ke procedure cek_nopol_aktif
    //    Procedure baru mendeteksi booking aktif di CABANG LAIN
    if (n.name === 'MySQL: Cek Duplikat Booking') {
      n.name = 'MySQL: Cek Nopol Aktif';
      n.id = 'cek-nopol-aktif';
      n.parameters.query = `CALL cek_nopol_aktif(
  '{{ $('Gemini: Ekstrak Data Booking').item.json.nopol }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.cabang_id }}',
  @is_blocked, @kode, @cabang_lain
);
SELECT @is_blocked AS is_blocked, @kode AS kode_existing, @cabang_lain AS cabang_existing;`;
    }
    
    // 6. IF: Duplikat? — update field yang dicek (sesuaikan dengan output procedure baru)
    if (n.name === 'Duplikat?') {
      n.name = 'IF: Nopol Terdaftar di Cabang Lain?';
      n.id = 'if-nopol-blocked';
      n.parameters.conditions.conditions = [{
        id: 'blocked',
        leftValue: '={{ $json.is_blocked }}',
        rightValue: 1,
        operator: { type: 'number', operation: 'equals' }
      }];
    }
    
    // 7. GoWA: Kirim Notif Duplikat — update pesan agar informatif
    if (n.name === 'GoWA: Kirim Notif Duplikat') {
      n.parameters.message = `={{ 'Mohon maaf Kak, plat nomor *' + $('Gemini: Ekstrak Data Booking').item.json.nopol + '* sudah memiliki booking aktif di Cabang *' + ($('MySQL: Cek Nopol Aktif').item.json.cabang_existing || '').charAt(0).toUpperCase() + ($('MySQL: Cek Nopol Aktif').item.json.cabang_existing || '').slice(1) + '* dengan kode *' + $('MySQL: Cek Nopol Aktif').item.json.kode_existing + '*.' + '\\n\\nMohon konfirmasi ke cabang tersebut ya, atau batalkan booking lama dahulu sebelum booking baru. 🙏' }}`;
    }
    
    // 8. MySQL: Insert Booking — pastikan cabang_id diambil dari hasil ekstrak
    //    (sudah diisi otomatis dari device_id di code node)
    if (n.name === 'MySQL: Insert Booking') {
      n.parameters.query = `INSERT INTO booking (id, nopol, nama_pelanggan, nomor_wa, cabang_id, waktu_booking, layanan, status)
VALUES (
  '{{ $('Code: Generate Kode').item.json.kode_booking }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.nopol }}',
  '{{ $('Webhook (From Main Router)').item.json.body.nama_pelanggan || 'Pelanggan' }}',
  '{{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.cabang_id }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.waktu }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.layanan }}',
  'pending'
);`;
    }
    
    // 9. MySQL: Update Database Pelanggan — simpan cabang_default
    if (n.name === 'MySQL: Update Database Pelanggan') {
      n.parameters.query = `INSERT INTO pelanggan (nomor_wa, nama, nopol, motor, cabang_default)
VALUES (
  '{{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}',
  '{{ $('Webhook (From Main Router)').item.json.body.nama_pelanggan || 'Pelanggan' }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.nopol }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.motor }}',
  '{{ $('Gemini: Ekstrak Data Booking').item.json.cabang_id }}'
)
ON DUPLICATE KEY UPDATE 
  nopol          = VALUES(nopol), 
  motor          = VALUES(motor),
  cabang_default = VALUES(cabang_default),
  updated_at     = NOW();`;
    }
    
    // 10. GoWA: Konfirmasi Booking — tambahkan nama cabang di konfirmasi
    if (n.name === 'GoWA: Konfirmasi Booking') {
      n.parameters.message = `={{ 'Alhamdulillah, booking servis *' + $('Gemini: Ekstrak Data Booking').item.json.layanan + '* sudah terkonfirmasi! 🎉\\n\\n' + '📋 Motor: ' + $('Gemini: Ekstrak Data Booking').item.json.motor + '\\n' + '🏍️ Plat: *' + $('Gemini: Ekstrak Data Booking').item.json.nopol + '*\\n' + '📅 Jadwal: ' + $('Gemini: Ekstrak Data Booking').item.json.waktu + '\\n' + '📍 Cabang: *' + ($('Gemini: Ekstrak Data Booking').item.json.cabang_id || '').charAt(0).toUpperCase() + ($('Gemini: Ekstrak Data Booking').item.json.cabang_id || '').slice(1) + '*\\n\\n' + '🎟️ *KODE BOOKING: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\n' + 'Tunjukkan kode ini ke kasir saat kedatangan ya Kak! Kami tunggu 😁' }}`;
    }
  });
  
  return data;
}

// =============================================
// Run patches
// =============================================
console.log('=== FitMotor Workflow Patcher v2 ===\n');

const files = [
  { file: '01_main_router.json', patcher: patch01 },
  { file: '02_booking_flow.json', patcher: patch02 }
];

files.forEach(({ file, patcher }) => {
  const p = './n8n-workflows/' + file;
  if (!require('fs').existsSync(p)) { console.log('FILE NOT FOUND:', p); return; }
  
  let data = JSON.parse(require('fs').readFileSync(p, 'utf8'));
  data = patcher(data);
  require('fs').writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log('PATCHED:', file, '(' + data.nodes.length + ' nodes)');
});

console.log('\n✅ All patches applied! Import ke n8n untuk mengaktifkan.');
