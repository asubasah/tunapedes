# 🐛 Bug Prevention Register — Fit Motor WhatsApp AI CRM
## Dokumentasi semua potensi bug dan cara pencegahannya

---

## KATEGORI 1 — BUG DATA & DATABASE

### BUG-001: Duplikat Booking Nopol Sama
**Risiko:** Pelanggan tidak sengaja booking 2x di hari yang sama, menyebabkan konflik slot teknisi.
**Pencegahan:**
- `checkDuplicateBooking()` di `BookingHandler.gs` cek nopol + tanggal sebelum `appendRow`
- Return `status: 'duplicate'` dengan info booking existing
- UI Antigravity tampilkan pesan khusus + opsi lihat/ganti/batal existing

**Test case:** Booking nopol G 1234 AB jam 10:00, lalu coba lagi jam 14:00 hari sama → harus tolak

---

### BUG-002: Race Condition Double Write di Google Sheets
**Risiko:** 2 WhatsApp masuk bersamaan (misal 2 akun WA berbeda di rush hour) bisa append row ganda.
**Pencegahan:**
- Semua write operation menggunakan `LockService.getScriptLock().waitLock(30000)`
- Lock direlease di blok `finally` untuk memastikan selalu dilepas walau error
- Setelah lock, re-fetch data untuk konfirmasi tidak ada yang insert duluan

---

### BUG-003: Nomor WA Format Tidak Konsisten
**Risiko:** `628123` vs `08123` vs `+62 812-3` → gagal match di lookup
**Pencegahan:**
- Fungsi `normalizePhone()` di `CustomerHandler.gs` — normalisasi SEMUA nomor ke `628xxx`
- Dipanggil sebelum store DAN sebelum lookup
- Hilangkan semua: spasi, dash, +, tanda baca

**Test case:** Test dengan input `0812-xxxx`, `+62812xxxx`, `62812xxxx` → harus sama hasilnya

---

### BUG-004: Kolom Sheet Bergeser / Header Berubah
**Risiko:** Jika admin manual menambah/hapus kolom di Sheets, semua index akan salah.
**Pencegahan:**
- Semua index kolom terpusat di konstanta `COL` di `Code.gs`
- JANGAN gunakan magic number (misal `row[5]`) langsung di kode
- Gunakan `row[COL.BOOKING.LAYANAN]` agar mudah update jika kolom bergeser

**Prosedur:** Jika ubah kolom Sheets, update `COL` di `Code.gs` dan test ulang semua fungsi

---

### BUG-005: Reminder Terkirim Dua Kali
**Risiko:** Trigger scheduler terdaftar ganda (duplikat trigger) → reminder terkirim 2x ke pelanggan.
**Pencegahan:**
- `setupAllTriggers()` hapus SEMUA trigger lama sebelum buat baru
- `cleanupDuplicateTriggers()` tersedia untuk pembersihan manual
- Field `reminder_sent` di Sheets dicek sebelum kirim — idempoten
- Update `reminder_sent = TRUE` segera setelah kirim berhasil (bukan setelah loop selesai)

---

## KATEGORI 2 — BUG WAKTU & TIMEZONE

### BUG-006: Booking Cutoff Salah Timezone
**Risiko:** Server Google Apps Script menggunakan UTC. Jam 17:00 WIB = 10:00 UTC. Jika pakai `new Date().getHours()` langsung, akan salah 7 jam.
**Pencegahan:**
- SELALU gunakan `Utilities.formatDate(date, 'Asia/Jakarta', format)` untuk operasi waktu
- Fungsi `formatWIB()` tersedia sebagai wrapper
- Semua perbandingan waktu cutoff dalam WIB

**Test case:** Booking jam 16:30 WIB (09:30 UTC) pada hari Senin → harus ditolak (melewati cutoff 16:00)

---

### BUG-007: Weekend Detection Salah
**Risiko:** `new Date().getDay()` return 0 (Minggu) dan 6 (Sabtu), tapi bisa salah jika hari tepat tengah malam.
**Pencegahan:**
- Gunakan `Utilities.formatDate(now, 'Asia/Jakarta', 'EEEE')` untuk dapat nama hari dalam WIB
- Map nama hari Inggris ke Indonesia dengan lookup object

---

### BUG-008: Booking di Hari Libur Nasional
**Risiko:** Hari libur nasional (Lebaran, dll) bukan Minggu, tapi cabang tutup.
**Pencegahan (Future):**
- Tambahkan tab `Hari_Libur_Nasional` di Sheets: `[tanggal, keterangan]`
- Cek tabel ini di `validateBookingTime()` sebelum approve booking
- Update tabel setiap awal tahun

---

## KATEGORI 3 — BUG API & KONEKSI

### BUG-009: Google Maps API Quota Habis
**Risiko:** Jika > 2500 request/hari (free tier), semua kalkulasi jarak gagal → jemput antar tidak bisa diproses.
**Pencegahan:**
- `calculateJarak()` detect error `OVER_DAILY_LIMIT` dan kirim pesan informatif
- **Fallback:** Gunakan Haversine formula (offline) untuk estimasi jarak ketika API error
- Monitor quota di Google Cloud Console, set alert di 80%
- Cache hasil kalkulasi jarak per nomor WA (simpan di Sheets) untuk mengurangi API call

---

### BUG-010: Antigravity Webhook Timeout / Down
**Risiko:** Jika Antigravity mengalami downtime saat reminder dijadwalkan, pesan tidak terkirim.
**Pencegahan:**
- `sendToAntigravity()` menggunakan retry 3x dengan exponential backoff
- Log kegagalan ke sheet `Log_Error`
- Field `reminder_sent` TIDAK di-update jika pengiriman gagal → akan retry besok (tapi perlu manual check)
- Buat monitoring query di Sheets: filter `reminder_sent = FALSE AND tanggal_booking < TODAY()`

---

### BUG-011: Google Apps Script Execution Timeout (6 menit)
**Risiko:** Jika booking hari ini sangat banyak (misal 100+), loop reminder bisa timeout.
**Pencegahan:**
- Batasi `MAX_PER_SESSION = 50` reminder per trigger run
- Sisanya akan dikirim oleh trigger selanjutnya (jika perlu, tambah trigger jam 07:00)
- Monitor di Execution Logs apakah ada yang timeout

---

## KATEGORI 4 — BUG FLOW & LOGIC

### BUG-012: CXCT Broadcast Masuk Loop FAQ
**Risiko:** AI menerima pesan broadcast CXCT01, menjawabnya sebagai FAQ biasa, pelanggan bingung.
**Pencegahan:**
- Deteksi kode CXCT di **node pertama** setelah pesan masuk (sebelum intent classifier)
- Set flag `is_promo_flow = TRUE` → bypass semua trigger FAQ
- Promo flow memiliki exit node sendiri yang reset flag
- Test: kirim "CXCT01" dan verifikasi masuk promo flow, bukan FAQ

---

### BUG-013: Fallback Counter Tidak Reset
**Risiko:** Setelah eskalasi ke admin, pelanggan memulai percakapan baru tapi counter masih 3 → langsung eskalasi lagi.
**Pencegahan:**
- Reset `fallback_count = 0` setelah eskalasi
- Reset juga saat: sesi baru dimulai, pelanggan bisa kembali ke menu utama, setelah AI pause selesai

---

### BUG-014: AI Pause Tidak Release
**Risiko:** Pada edge case tertentu (server restart, error), AI pause tidak release setelah 15 menit → AI mati permanen.
**Pencegahan:**
- Simpan timestamp mulai pause, bukan hanya flag boolean
- Cek: `IF NOW() > pause_started_at + 900s → release`
- Tambahkan "health check" script yang verify status AI setiap jam

---

### BUG-015: Non-AI List Tidak Dicek di Setiap Pesan
**Risiko:** Jika logika Non-AI check hanya ada di awal sesi, pesan lanjutan dari non-AI list bisa diproses AI.
**Pencegahan:**
- Check Non-AI List di **setiap** pesan masuk, bukan hanya pembuka sesi
- Karena di Antigravity, gunakan kondisi global atau middleware node

---

### BUG-016: Pelanggan Kirim Lokasi Format Google Maps Link
**Risiko:** WA kadang kirim lokasi sebagai link `https://maps.app.goo.gl/...` bukan koordinat — tidak bisa di-parse langsung.
**Pencegahan:**
- `sanitizeLocationInput()` deteksi format koordinat vs teks alamat
- Jika link maps: minta pelanggan kirim ulang via tombol Lokasi WA (bukan link)
- Pesan error informatif dengan instruksi ulang yang jelas

---

### BUG-017: Subflow Cabang Penuh Tidak Menawarkan Alternatif
**Risiko:** Saat `checkCabangCapacity()` return penuh, jika tidak ada logika fallback, pelanggan stuck.
**Pencegahan:**
- Booking flow setelah `capacity_full` langsung trigger Subflow F (Pengalihan Cabang)
- `cariCabangTerdekat()` otomatis list cabang lain yang masih buka
- Selalu ada minimal 2 opsi: ganti tanggal ATAU ganti cabang

---

### BUG-018: Ghosting Handler Kirim ke Pelanggan yang Sudah Konfirmasi
**Risiko:** Jika status booking tidak diupdate tepat waktu, ghosting trigger bisa aktif meski booking sudah confirmed.
**Pencegahan:**
- `checkGhostingPelanggan()` hanya proses status `'pending'`
- Admin wajib update status ke `'confirmed'` setelah admin konfirmasi
- Tambahkan reminder ke admin: "Update status booking setelah konfirmasi dengan pelanggan"

---

### BUG-019: Pesan Admin Diparsing sebagai Pesan Pelanggan
**Risiko:** Jika admin menggunakan akun WA yang sama dengan bot (1 nomor untuk 2 peran), AI bisa membalas dirinya sendiri.
**Pencegahan:**
- Pisahkan nomor admin dan nomor bot sepenuhnya
- Di Antigravity: konfigurasi Human Takeover yang akurat mendeteksi pesan keluar

---

### BUG-020: Data Motor Tidak Valid (Tahun Karburator)
**Risiko:** Pelanggan motor karburator booking full service → teknisi kaget, jam kerja terbuang.
**Pencegahan:**
- Di step input data motor baru, tanyakan: "Apakah motor Anda injeksi atau karburator?"
- Jika karburator → informasikan ketentuan → tawarkan layanan yang tersedia
- Validasi tahun < 2010 → otomatis batasi opsi layanan

---

## KATEGORI 5 — BUG KEAMANAN

### BUG-021: Injeksi Data ke Google Sheets
**Risiko:** Pelanggan kirim `=CMD("...")` atau formula Excel di field nama/nopol → **formula injection**.
**Pencegahan:**
- SEMUA input yang masuk ke `appendRow` harus di-prefix dengan `'` (apostrophe) jika dimulai dengan `=`, `+`, `-`, `@`
- Contoh: `"=SUM(1,1)"` → simpan sebagai `"'=SUM(1,1)"`
- Google Sheets auto-treat string dengan prefix `'` sebagai teks biasa

---

### BUG-022: API Key Exposed di Kode
**Risiko:** API Key GMaps atau Antigravity webhook tersimpan hardcode di kode → bisa bocor.
**Pencegahan:**
- SEMUA secrets disimpan di `PropertiesService.getScriptProperties()`
- Set via: Apps Script → Project Settings → Script Properties
- Kode hanya akses via `PropertiesService.getScriptProperties().getProperty('KEY_NAME')`

---

## Checklist Deployment (Anti-Bug)

- [ ] Semua API key di Script Properties, bukan kode
- [ ] Test `normalizePhone()` dengan 5 format berbeda
- [ ] Test booking weekday + weekend cutoff (timezone WIB)
- [ ] Test duplikat booking → harus ditolak
- [ ] Test jemput < 2km, 2–7km, > 7km
- [ ] Test CXCT01/02/03 tidak masuk FAQ loop
- [ ] Test fallback 3x → eskalasi admin
- [ ] Test Non-AI List → skip AI
- [ ] Test reminder hanya terkirim sekali (jalankan trigger 2x)
- [ ] Test ghosting 24h + 48h
- [ ] Test formula injection di field nama
- [ ] Verifikasi Lock Service berfungsi (concurrent test)
- [ ] Monitor Log_Error sheet setelah 1 hari live
