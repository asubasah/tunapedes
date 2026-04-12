# 📋 Google Sheets — Setup Guide
## Panduan membuat struktur database Fit Motor dari nol

---

## LANGKAH 1: Buat Spreadsheet

1. Buka [sheets.google.com](https://sheets.google.com)
2. Buat spreadsheet baru: **"FitMotor_Database"**
3. Salin ID dari URL bar:
   `https://docs.google.com/spreadsheets/d/**[ID_INI]**/edit`
4. Simpan di `config/env.json` → field `spreadsheet_id`

---

## LANGKAH 2: Buat Tab & Header

### Tab 1: `Pelanggan`
```
Baris 1 (Header — BOLD, Background Biru Muda):
A1: id_pelanggan
B1: nama
C1: nomor_wa
D1: motor
E1: nopol
F1: pernah_jemput
G1: alamat_jemput_terakhir
H1: cabang_default
I1: is_non_ai
J1: tanggal_daftar
```

### Tab 2: `Booking`
```
Baris 1 (Header — BOLD, Background Hijau Muda):
A1: id_booking
B1: nopol
C1: nama
D1: nomor_wa
E1: waktu_booking
F1: layanan
G1: cabang
H1: status_jemput
I1: jarak_km
J1: biaya_jemput
K1: status_booking
L1: reminder_sent
M1: created_at
N1: ghosting_follow_sent
```

### Tab 3: `Riwayat_Servis`
```
Baris 1 (Header — BOLD, Background Orange Muda):
A1: nopol
B1: tanggal_servis
C1: jenis_servis
D1: oli_digunakan
E1: kilometer
F1: cabang
G1: teknisi
H1: catatan
```

### Tab 4: `Non_AI_List`
```
Baris 1 (Header — BOLD, Background Merah Muda):
A1: nomor_wa
B1: nama
C1: alasan
D1: added_by
E1: added_at
```

### Tab 5: `Log_Error` (Otomatis diisi oleh script)
```
Baris 1 (Header — BOLD, Background Abu-abu):
A1: timestamp
B1: context
C1: message
D1: detail
```

---

## LANGKAH 3: Proteksi Header

Untuk setiap tab:
1. Select baris 1
2. Klik kanan → **Protect range**
3. Set: "Only you can edit this range"
4. Ini mencegah header ter-overwrite oleh Apps Script

---

## LANGKAH 4: Validasi Data (Dropdown)

### Tab Booking — Kolom K (status_booking):
1. Select kolom K (mulai K2)
2. Data → Data Validation
3. Criteria: **List of items**
4. Items: `pending,confirmed,selesai,batal`

### Tab Booking — Kolom H (status_jemput):
1. Select kolom H (mulai H2)
2. Data → Data Validation
3. Items: `antar_sendiri,jemput_antar`

### Tab Pelanggan — Kolom F & I (boolean):
1. Select kolom F & I
2. Data → Data Validation
3. Items: `TRUE,FALSE`

---

## LANGKAH 5: Format Kolom

| Tab | Kolom | Format |
|-----|-------|--------|
| Booking | E (waktu_booking) | Date time: `YYYY-MM-DD HH:MM` |
| Booking | I (jarak_km) | Number: 1 desimal |
| Booking | J (biaya_jemput) | Currency: Rp |
| Pelanggan | J (tanggal_daftar) | Date time |
| Riwayat | B (tanggal_servis) | Date: `YYYY-MM-DD` |
| Log_Error | A (timestamp) | Date time |

---

## LANGKAH 6: Setup Google Apps Script

1. Di Spreadsheet: **Extensions → Apps Script**
2. Upload semua file `.gs`:
   - `Code.gs`
   - `CustomerHandler.gs`
   - `BookingHandler.gs`
   - `JemputHandler.gs`
   - `RiwayatHandler.gs`
   - `ReminderScheduler.gs`
3. Ganti nama project: **"FitMotor CRM Backend"**

---

## LANGKAH 7: Set Script Properties (Secrets)

Di Apps Script Editor:
1. ⚙️ Gear icon → **Project Settings**
2. Scroll ke **Script Properties**
3. Add properties:

| Property Key | Value |
|--------------|-------|
| `SPREADSHEET_ID` | [ID dari langkah 1] |
| `GMAPS_API_KEY` | [Google Maps API Key Anda] |
| `AG_WEBHOOK_URL` | [Webhook URL dari Antigravity] |

---

## LANGKAH 8: Deploy sebagai Web App

1. Deploy → **New Deployment**
2. Type: **Web App**
3. Execute as: **Me**
4. Who has access: **Anyone** (agar Antigravity bisa kirim webhook)
5. Salin **Web App URL** → masukkan ke Antigravity sebagai webhook endpoint

---

## LANGKAH 9: Aktifkan Triggers

Dari Apps Script Editor, jalankan fungsi ini SEKALI:
```
setupAllTriggers()
```

Ini akan membuat:
- Trigger 1: `sendDailyReminders` — setiap hari jam 06:00 WIB
- Trigger 2: `checkGhostingPelanggan` — setiap 6 jam

---

## LANGKAH 10: Test Awal

1. Jalankan `doPost` dengan payload test:
   ```json
   {"type": "CHECK_NON_AI", "nomor_wa": "081234567890"}
   ```
2. Expected response: `{"status":"not_found","is_non_ai":false}`
3. Jika berhasil, semua koneksi sudah benar

---

## Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| Error: "Sheet tidak ditemukan" | Pastikan nama tab sama persis (case-sensitive) |
| Error: "Script properties not found" | Set semua 3 properties di langkah 7 |
| Reminder tidak terkirim | Cek Execution Logs di Apps Script (View → Executions) |
| API Maps error | Verifikasi billing aktif di Google Cloud Console |
| Duplicate trigger | Jalankan `cleanupDuplicateTriggers()` |
