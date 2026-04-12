# ✅ Testing Checklist — Fit Motor WhatsApp AI CRM
## 20 Skenario Sandbox Test Wajib Sebelum Go-Live

**Instruksi:** Centang ✅ setiap skenario yang sudah lulus.
Jangan go-live sebelum semua **PASS**.

---

## GROUP A — Identifikasi & Routing Pelanggan

### TEST-01: Pelanggan Terdaftar
- Input: WA dari nomor yang ada di tab Pelanggan
- Expected: Sapaan dengan nama lengkap "Halo, [Nama]!"
- Verifikasi: Nama muncul benar, bukan "Sobat Fit"
- Status: [ ] PASS [ ] FAIL

### TEST-02: Pelanggan Baru
- Input: WA dari nomor baru yang belum ada di database
- Expected: Sapaan "Halo, Sobat Fit!" + menu lengkap muncul
- Status: [ ] PASS [ ] FAIL

### TEST-03: Non-AI List Bypass
- Setup: Tambahkan nomor test ke tab Non_AI_List
- Input: Kirim pesan apapun dari nomor tersebut
- Expected: AI tidak merespons, admin mendapat notifikasi
- Verifikasi: Cek notif admin masuk dengan format yang benar
- Status: [ ] PASS [ ] FAIL

### TEST-04: Fallback 3 Kali Berurutan
- Input: Kirim stiker WA → stiker WA → voice note (3x konten tidak bisa dibaca)
- Expected:
  - Setelah 1x: pesan fallback_1
  - Setelah 2x: pesan fallback_2 dengan hint menu
  - Setelah 3x: pesan eskalasi admin + notif ke admin
- Verifikasi: Counter reset setelah eskalasi
- Status: [ ] PASS [ ] FAIL

---

## GROUP B — Booking (Subflow A)

### TEST-05: Booking Weekday Valid
- Setup: Hari kerja, waktu saat ini misalnya 10:00 WIB
- Input: Booking untuk jam 14:00 hari yang sama (masih dalam cutoff)
- Expected: Booking berhasil, data tersimpan di tab Booking, notif admin masuk
- Verifikasi: Cek Sheets — row baru dengan status 'pending'
- Status: [ ] PASS [ ] FAIL

### TEST-06: Booking Weekday Invalid (Setelah Cutoff)
- Setup: Hari kerja, waktu saat ini 16:30 WIB
- Input: Booking untuk hari ini jam 17:00
- Expected: Ditolak dengan pesan "Batas booking jam 16:00"
- Status: [ ] PASS [ ] FAIL

### TEST-07: Booking Weekend Invalid
- Setup: Hari Sabtu, waktu saat ini 15:30 WIB
- Input: Booking untuk hari ini jam 16:00
- Expected: Ditolak dengan pesan "Batas booking weekend jam 15:00"
- Status: [ ] PASS [ ] FAIL

### TEST-08: Nopol Tidak Ditemukan di Database
- Input: Nopol random yang belum terdaftar (misal "A 9999 ZZ")
- Expected: AI menyatakan nopol belum terdaftar + minta data motor baru
- Verifikasi: Setelah input data baru, pelanggan terdaftar di tab Pelanggan
- Status: [ ] PASS [ ] FAIL

### TEST-09: Duplikat Booking (Nopol + Hari Sama)
- Setup: Buat booking dulu untuk nopol X hari Y
- Input: Coba booking lagi untuk nopol X hari Y (jam berbeda)
- Expected: Ditolak dengan info booking existing + opsi ubah/batal
- Status: [ ] PASS [ ] FAIL

### TEST-10: Cabang Penuh
- Setup: Isi kapasitas cabang Adiwerna hari ini hingga penuh (30 booking)
- Input: Coba booking ke cabang Adiwerna hari itu
- Expected: Ditolak, ditawarkan cabang alternatif terdekat yang buka
- Status: [ ] PASS [ ] FAIL

---

## GROUP C — Jemput Antar (Subflow B)

### TEST-11: Jemput Dalam Radius Minimal (< 2 km)
- Input: Lokasi yang berjarak ~1 km dari cabang
- Expected: Biaya flat Rp 6.000, konfirmasi diterima, booking tersimpan
- Status: [ ] PASS [ ] FAIL

### TEST-12: Jemput Dalam Radius Menengah (2–7 km)
- Input: Lokasi yang berjarak ~4 km dari cabang
- Expected: Biaya Rp 12.000 (4 km × 3.000), konfirmasi booking
- Verifikasi: Cek kolom biaya_jemput di tab Booking
- Status: [ ] PASS [ ] FAIL

### TEST-13: Jemput Di Luar Radius (> 7 km)
- Input: Lokasi yang berjarak 10 km dari cabang terdekat
- Expected: Ditolak layanan jemput + info cabang terdekat + ajakan datang langsung
- Status: [ ] PASS [ ] FAIL

### TEST-14: Konfirmasi Ulang Alamat Jemput Lama
- Setup: Pelanggan yang sudah pernah jemput (pernah_jemput = TRUE)
- Input: Pilih menu Jemput Antar
- Expected: AI tanya "mau jemput di alamat sama?" + tampilkan alamat terakhir
- Status: [ ] PASS [ ] FAIL

### TEST-15: Lokasi Format Tidak Valid
- Input: Kirim teks "rumah saya" (tanpa koordinat, tanpa alamat jelas)
- Expected: Pesan error + instruksi ulang cara kirim lokasi WA
- Status: [ ] PASS [ ] FAIL

---

## GROUP D — Automation & Maintenance

### TEST-16: Reminder Pagi Terkirim Tepat Waktu
- Setup: Buat booking dengan status 'confirmed' untuk besok, reminder_sent = FALSE
- Aksi: Jalankan fungsi `sendDailyReminders()` secara manual
- Expected: Pesan reminder terkirim, reminder_sent berubah jadi TRUE di Sheets
- Verifikasi: Jalankan lagi → pesan NOT dikirim lagi (idempoten)
- Status: [ ] PASS [ ] FAIL

### TEST-17: Ghosting Follow-up 24 Jam
- Setup: Buat booking dengan status 'pending', created_at 25 jam yang lalu
- Aksi: Jalankan `checkGhostingPelanggan()` manual
- Expected: Pesan ghosting_followup terkirim, ghosting_sent = 'SENT_1'
- Status: [ ] PASS [ ] FAIL

### TEST-18: CXCT01 Tidak Masuk Loop FAQ
- Input: Kirim pesan mengandung "CXCT01"
- Expected: Masuk promo flow 1 (bukan menu FAQ biasa)
- Verifikasi: Balas dengan pertanyaan FAQ biasa → harus masuk FAQ, bukan promo lagi
- Note: Cek tidak ada loop balik ke promo setelah FAQ dijawab
- Status: [ ] PASS [ ] FAIL

### TEST-19: Komplain Keyword Terdeteksi
- Input: "saya sangat kecewa dengan pelayanan fit motor"
- Expected:
  - AI balas dengan template empatik (bukan menu biasa)
  - Notif komplain masuk ke admin dalam < 30 detik
  - Sesi di-tag 'komplain_menunggu'
- Status: [ ] PASS [ ] FAIL

### TEST-20: AI Pause Setelah Admin Reply
- Setup: Admin kirim pesan manual dari dashboard ke pelanggan A
- Expected:
  - AI tidak merespons pesan pelanggan A selama 15 menit
  - Setelah 15 menit, AI aktif kembali
- Verifikasi: Pengujian dengan timer stopwatch
- Status: [ ] PASS [ ] FAIL

---

## Post-Test Verification

Setelah semua test selesai:

| Cek | Status |
|-----|--------|
| Tab Booking berisi semua booking test dengan data benar | [ ] |
| Tab Pelanggan berisi pendaftaran baru dari test | [ ] |
| Tab Log_Error kosong (tidak ada error tidak terduga) | [ ] |
| Semua notifikasi admin masuk dengan format benar | [ ] |
| reminder_sent = TRUE untuk semua booking yang sudah direminder | [ ] |
| Tidak ada duplikat row di semua tab Sheets | [ ] |

---

## Go/No-Go Decision

| Kondisi | Nilai |
|---------|-------|
| Semua 20 test PASS | Required |
| Log_Error kosong setelah 24 jam pilot | Required |
| Admin konfirmasi notifikasi format benar | Required |
| Reminder terkirim akurat (tidak double/skip) | Required |

**GO-LIVE:** Mulai dari 1 cabang (rekomendasi: Adiwerna) → monitor 3 hari → rollout semua
