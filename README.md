# 🏍️ Fit Motor — WhatsApp AI CRM System

Platform: Antigravity | Channel: WhatsApp Business API (5 Cabang)
Version: 1.0.0 | Last Updated: 2026-04-12

## Struktur Proyek

```
fitmorot/
├── config/               # Konfigurasi global (cabang, variabel, keyword)
├── google-apps-script/   # Semua kode backend Google Apps Script
├── knowledge-base/       # Konten AI Brain (KB Antigravity)
├── templates/            # Template pesan WhatsApp
├── docs/                 # Dokumentasi teknis & checklist
└── README.md
```

## Setup Cepat

1. Buat Google Spreadsheet baru → salin ID-nya ke `config/env.json`
2. Deploy semua file `google-apps-script/*.gs` ke Google Apps Script
3. Jalankan `setupTrigger()` untuk aktifkan scheduler jam 06:00 WIB
4. Upload folder `knowledge-base/` ke modul Knowledge Antigravity
5. Set semua variabel dari `config/variables.json` ke Antigravity Settings
6. Import `config/cabang.json` ke node cabang di Canvas Antigravity
7. Bangun 9 Subflow sesuai urutan di `docs/implementation-plan.md`
8. Jalankan semua 20 skenario test di `docs/testing-checklist.md`

## Dependencies

- Google Sheets API v4
- Google Maps Distance Matrix API
- Antigravity Platform (Scheduler + Human Takeover aktif)
- WhatsApp Business API (WABA) — 5 nomor cabang
