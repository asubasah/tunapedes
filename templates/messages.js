// ============================================================
// FitMotor — Semua Template Pesan WhatsApp
// File: templates/messages.js
//
// PETUNJUK: Copy-paste setiap template ke node pesan di
//           Antigravity Canvas. Gunakan {{variabel}} sesuai
//           nama variabel yang sudah didefinisikan di Settings.
//
// FORMAT:
//  - *teks* = bold di WA
//  - _teks_ = italic di WA
//  - emoji digunakan dengan hemat & konsisten
// ============================================================

const MESSAGES = {

  // ── GREETING ─────────────────────────────────────────────

  greeting_registered: `Halo, *{{customer_name}}*! 👋

Selamat datang kembali di *Fit Motor* 🏍️

Ada yang bisa kami bantu hari ini?

1️⃣  Booking Servis
2️⃣  Layanan Jemput Antar
3️⃣  Cek Riwayat Servis
4️⃣  Info Cabang & Jam Buka
5️⃣  Konsultasi Gejala Motor
6️⃣  FAQ & Info Harga
7️⃣  Komplain / Saran

Ketik angka pilihannya ya 😊`,

  greeting_new: `Halo, *Sobat Fit*! 👋

Selamat datang di *Fit Motor* — Bengkel Motor Injeksi Terpercaya di Tegal! 🏍️

Ada yang bisa kami bantu?

1️⃣  Booking Servis
2️⃣  Layanan Jemput Antar
3️⃣  Cek Riwayat Servis
4️⃣  Info Cabang & Jam Buka
5️⃣  Konsultasi Gejala Motor
6️⃣  FAQ & Info Harga
7️⃣  Komplain / Saran

Ketik angka pilihannya ya 😊`,

  // ── SUBFLOW A — BOOKING ──────────────────────────────────

  booking_minta_nopol: `Siap! Untuk booking servis, boleh sebutkan *nomor polisi motor* Anda dulu? 🏍️

Contoh: _G 1234 AB_`,

  booking_nopol_tidak_ditemukan: `Nopol *{{nopol}}* belum terdaftar di database kami.

Jangan khawatir, kami akan daftarkan sekarang 😊
Boleh sebutkan:
1. *Nama lengkap* Anda
2. *Jenis & tahun motor* (contoh: Honda Beat 2022)`,

  booking_tampilkan_riwayat: `Halo! Kami menemukan data motor Anda 😊

🏍️ Motor: *{{motor}}*
📅 Servis terakhir: *{{tanggal_servis_terakhir}}*
🔧 Layanan: *{{jenis_servis_terakhir}}*
📍 Cabang: *{{cabang_terakhir}}*

Mau booking servis lagi? Pilih cabang tujuan:

{{daftar_cabang}}

Ketik nomor pilihannya 😊`,

  booking_pilih_layanan: `Pilih jenis layanan untuk motor {{nopol}}:

1️⃣  Servis Rutin
2️⃣  Ganti Oli
3️⃣  Full Service
4️⃣  Tune-up
5️⃣  CVT Service (Matic)
6️⃣  Throttle Body Cleaning
7️⃣  Cek Rem
8️⃣  Lainnya

Ketik angka pilihannya`,

  booking_minta_waktu: `Kapan rencana servisnya? 📅

Silakan ketik waktu dalam format:
*YYYY-MM-DD HH:MM*

Contoh: _2026-04-15 10:00_

Info jam operasional: *08:00 – 17:00*
_(Weekday last booking 16:00 | Weekend last booking 15:00)_`,

  booking_waktu_invalid: `Maaf, waktu yang dipilih tidak valid 🙏

*Alasan:* {{alasan_invalid}}

Silakan pilih waktu lain ya. Contoh format: _2026-04-15 10:00_`,

  booking_konfirmasi: `✅ *Booking Berhasil Dibuat!*

📋 Ringkasan Booking:
🏍️ Nopol: *{{nopol}}*
👤 Nama: *{{nama}}*
🔧 Layanan: *{{layanan}}*
📅 Waktu: *{{waktu_booking}}*
📍 Cabang: *{{cabang}}*
🚗 Jemput Antar: *{{status_jemput_label}}*
{{baris_biaya_jemput}}
📌 ID Booking: _{{booking_id}}_

Kami akan kirim *reminder pagi hari H* ya! ☀️
Terima kasih, Sobat Fit! 🙏`,

  booking_duplikat: `Hei! Motor *{{nopol}}* sudah memiliki booking pada tanggal *{{tanggal_existing}}* 📋

Mau:
1. Lihat detail booking existing
2. Ganti ke tanggal lain
3. Batalkan booking existing & buat baru`,

  booking_cabang_penuh: `Maaf, cabang *{{cabang}}* sudah penuh untuk tanggal *{{tanggal}}* 😔

Pilihan untuk Anda:
1. Pilih tanggal lain di cabang {{cabang}}
2. Pilih cabang terdekat yang masih tersedia

Mau kami carikan alternatif? 😊`,

  // ── SUBFLOW B — JEMPUT ANTAR ─────────────────────────────

  jemput_minta_lokasi_baru: `Untuk layanan jemput antar, silakan kirimkan lokasi Anda 📍

*Cara kirim lokasi:*
1. Tap ikon 📎 di WA → pilih *Lokasi* → kirim lokasi saat ini
2. Atau ketik *alamat lengkap* Anda

Radius layanan jemput: maks *7 km* dari cabang`,

  jemput_konfirmasi_alamat_lama: `Mau kami jemput di alamat yang sama seperti sebelumnya? 😊

📍 *{{alamat_jemput_terakhir}}*

Ketik *1* jika alamat sama
Ketik *2* jika ingin ganti alamat`,

  jemput_hitung_jarak: `⏳ Sedang menghitung jarak dari lokasi Anda...`,

  jemput_dalam_radius: `📍 Lokasi Anda: *{{jarak_km}} km* dari cabang *{{cabang}}*

💰 Estimasi biaya jemput: *Rp {{biaya_text}}*
🏍️ Motor: *{{nopol}}*

Setuju dengan biaya tersebut? Kami langsung proses booking!

Ketik *1* untuk Setuju
Ketik *2* untuk Batal`,

  jemput_diluar_radius: `Mohon maaf, lokasi Anda berada di luar jangkauan layanan jemput antar kami 🙏

📏 Jarak Anda: *{{jarak_km}} km* (maks layanan: 7 km)

Cabang terdekat dari lokasi Anda:
📍 *{{cabang_terdekat}}*
🗺️ {{alamat_cabang_terdekat}}

Silakan kunjungi langsung ya, kami siap melayani! 😊`,

  jemput_lokasi_tidak_valid: `Format lokasi yang dikirim tidak dapat kami proses 😔

Silakan coba lagi:
1. Tap 📎 → *Lokasi* → kirim GPS langsung
2. Atau ketik alamat lengkap (contoh: "Jl. Sudirman No.5, Adiwerna, Tegal")`,

  // ── SUBFLOW D — RIWAYAT SERVIS ──────────────────────────

  riwayat_minta_nopol: `Untuk cek riwayat servis, boleh sebutkan *nomor polisi motor* Anda? 🏍️

Contoh: _G 1234 AB_`,

  riwayat_tidak_ditemukan: `Nomor polisi *{{nopol}}* belum memiliki riwayat servis di Fit Motor 🔍

Mungkin motor Anda belum pernah servis di sini, atau nopol berbeda?

Mau coba nopol lain, atau ada yang bisa dibantu? 😊`,

  // ── SUBFLOW G — FAQ ──────────────────────────────────────

  faq_harga_servis: `📋 *Info Harga Servis Fit Motor*

🔧 Servis Rutin: mulai Rp ___.___ 
🛢️ Ganti Oli: mulai Rp ___.___ 
⚙️ Full Service: mulai Rp ___.___ 
🔩 CVT Service: mulai Rp ___.___ 
✨ Tune-up: mulai Rp ___.___

_*Harga bisa bervariasi tergantung jenis motor_

Mau booking sekarang? Ketik *1* untuk lanjut 😊`,

  faq_syarat_motor: `ℹ️ *Ketentuan Servis Fit Motor*

✅ Motor yang dilayani:
• Motor *injeksi (EFI)* semua merk
• Tahun *2010 ke atas*

❌ Tidak melayani:
• Motor karburator untuk full service
• Motor dua tak
• Motor tahun di bawah 2010 (full service)

Ada pertanyaan lain? 😊`,

  // ── SUBFLOW H — KONSULTASI ───────────────────────────────

  konsultasi_minta_gejala: `Silakan ceritakan gejala yang dirasakan pada motor Anda 🔍

Contoh: _"Mesin terasa kasar dan boros BBM"_
atau _"Motor susah distarter pagi hari"_

Kami akan bantu diagnosa dan rekomendasikan solusinya 😊`,

  konsultasi_rekomendasi: `🔍 *Hasil Konsultasi*

🏍️ Gejala: _{{gejala_pelanggan}}_

*Kemungkinan masalah:*
{{diagnosa}}

*Rekomendasi servis:*
{{rekomendasi_servis}}

🛢️ *Oli yang disarankan:*
{{rekomendasi_oli}}

---
Mau langsung booking servis? 😊
Ketik *1* untuk Booking Sekarang
Ketik *2* untuk Tanya Lebih Lanjut`,

  // ── REMINDER ─────────────────────────────────────────────

  reminder_pagi: `☀️ *Selamat Pagi, {{nama}}!*

Ini reminder servis motor Anda hari ini:

🏍️ Motor: *{{nopol}}*
🔧 Layanan: *{{layanan}}*
⏰ Jam: *{{jam_booking}}*
📍 Cabang: *{{cabang}}*
{{baris_jemput_antar}}

Sampai jumpa di Fit Motor ya, Sobat! 🙏
_Kalau ada perubahan, balas pesan ini ya._`,

  // ── GHOSTING ─────────────────────────────────────────────

  ghosting_followup: `Halo, *{{nama}}*! 👋

Kami perhatikan Anda belum sempat menyelesaikan booking servis motor *{{nopol}}*.

Masih ingin melanjutkan? 😊

Ketik *1* untuk Lanjut Booking
Ketik *2* untuk Batalkan`,

  ghosting_close: `Terima kasih sudah menghubungi *Fit Motor* 🙏

Kami tutup percakapan ini untuk sementara. Kapan pun Anda siap, chat kami lagi ya!

Sobat Fit selalu kami tunggu 😊`,

  // ── FALLBACK ─────────────────────────────────────────────

  fallback_1: `Maaf, kami kurang memahami pesan Anda 😊

Bisa diketik ulang? Atau pilih menu berikut:

📌 Ketik *menu* untuk lihat pilihan lengkap`,

  fallback_2: `Sepertinya ada kesulitan memahami permintaan ini 🙏

Coba ketik salah satu:
• *booking* — untuk jadwalkan servis
• *jemput* — untuk layanan antar jemput
• *riwayat* — untuk cek history servis
• *info* — untuk FAQ dan jam buka`,

  fallback_3_eskalasi: `Kami segera hubungkan Anda dengan tim Fit Motor kami 🙏

Mohon tunggu sebentar...`,

  // ── KOMPLAIN ─────────────────────────────────────────────

  komplain_empatik: `Kami sangat menyesal mendengar pengalaman yang kurang menyenangkan ini, *{{nama}}* 🙏

Kepuasan Sobat Fit adalah prioritas utama kami.

Tim kami akan segera menindaklanjuti hal ini secara langsung.

Boleh ceritakan lebih detail apa yang terjadi? 
Kami siap mendengarkan dan membantu sepenuhnya.`,

  // ── BROADCAST CXCT ───────────────────────────────────────

  broadcast_cxct01: `🔥 *PROMO SPESIAL — GANTI OLI HEMAT!*

Halo, *{{nama}}*! 

Dapatkan promo eksklusif *Ganti Oli* di semua cabang Fit Motor:

💰 Harga spesial khusus member
🗓️ Berlaku: [TANGGAL]
📍 Semua cabang Fit Motor

Mau langsung booking?
Ketik *1* untuk Booking Sekarang
Ketik *2* untuk Info Lebih Lanjut`,

  broadcast_cxct02: `⚙️ *PROMO SERVIS RUTIN HEMAT!*

Halo, *{{nama}}*!

Motor sehat, perjalanan lancar! 🏍️

Promo *Servis Rutin* bulan ini:
✅ [Detail promo]
🗓️ Berlaku: [TANGGAL]

Ketik *1* untuk Booking Sekarang`,

  broadcast_cxct03: `⭐ *PROGRAM LOYALTY FIT MOTOR*

Halo, *{{nama}}*!

Sebagai pelanggan setia, Anda mendapatkan:
🎁 [Benefit loyalty]
💳 Poin yang bisa ditukar

Ketik *1* untuk Info Lebih Lanjut`,

  // ── NOTIFIKASI ADMIN ─────────────────────────────────────

  notif_admin_booking: `🔔 *[BOOKING BARU]*

📌 ID: {{booking_id}}
👤 Nama: {{nama}}
📞 WA: {{nomor_wa}}
🏍️ Nopol: {{nopol}}
🔧 Layanan: {{layanan}}
📅 Waktu: {{waktu_booking}}
🚗 Jemput: {{status_jemput}}

_Harap konfirmasi booking!_`,

  notif_admin_komplain: `🚨 *[KOMPLAIN PELANGGAN]*

👤 Nama: {{nama}}
📞 WA: {{nomor_wa}}
⏰ Waktu: {{timestamp}}

💬 Pesan:
{{isi_komplain}}

⚠️ Respon dalam 2 jam!`,

  notif_admin_ghosting: `👻 *[GHOSTING — MANUAL FOLLOWUP]*

Pelanggan tidak merespons 48 jam:
👤 {{nama}} — {{nomor_wa}}
🏍️ Nopol: {{nopol}}
🔧 Layanan: {{layanan}}
📍 Cabang: {{cabang}}

📌 Booking ID: {{booking_id}}
Status diubah ke: *Batal*`,

  notif_admin_fallback: `🤖 *[FALLBACK ESKALASI]*

AI tidak bisa memahami pesan pelanggan (3x):
👤 {{nama}} — {{nomor_wa}}
💬 Pesan terakhir: {{pesan_terakhir}}

_Silakan tangani manual_`,

  notif_admin_nonai: `👑 *[NON-AI PELANGGAN]*

Pesan dari pelanggan VIP/khusus:
👤 {{nama}} — {{nomor_wa}}
💬 Pesan: {{isi_pesan}}

_Ditangani langsung oleh admin_`,

};

// Export untuk referensi
if (typeof module !== 'undefined') {
  module.exports = MESSAGES;
}
