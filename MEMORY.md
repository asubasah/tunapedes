# FIT MOTOR CRM - LONG TERM MEMORY 🧠

## Architecture Overview
Ini adalah mahakarya AI CRM Bengkel dengan standar Enterprise! Sistem ini bukan sekadar Chatbot, melainkan integrasi n8n + LLM Ollama (qwen2.5:3b) + MySQL + GoWA Multi-Device.

Sistem dibagi menjadi 5 Arus Utama Workflow (JSON) di n8n:
1. **`01_main_router.json`**: Pos Satpam / Pengatur Jalan (Router). Mengelompokkan Intent menggunakan Basic LLM Chain menjadi 4 cabang: `booking`, `jemput_antar`, `cek_booking`, dan `lainnya` (FAQ).
   * **Fitur Super:** Terdapat *Global Interceptor* di fungsi "Arahkan Sesi". Biarpun user punya `sesi_aktif`, jika chatnya menandung "BKG-", sistem akan menghancurkan paksaan sesi lambat dan langsung melemparnya ke alur pelacakan.
2. **`02_booking_flow.json`**: Alur servis bengkel reguler. Melakukan validasi Kapasitas dan Cek Duplikat. Jika sukses, memberikan *TICKET KODE BOOKING* (BKG-xxxx) dan otomatis menyimpan profil pelanggan ke DB.
3. **`03_jemput_antar_flow.json`**: Alur servis antar jemput / mogok jembatan. Terkoneksi dengan **Google Maps Distance Matrix API**. Menolak jika jarak > 7km, serta memiliki pengaman bypass otomatis jika limit env API terblokir.
4. **`04_maintenance_flow.json`** (Cron/Automated): Pasukan bayangan untuk memonitor *Ghosting* dan mengirimkan SMS pengingat jadwal rutin (Sales Engine).
5. **`05_cek_booking_flow.json`** (Keamanan Data & Tracking): Fitur canggih anti *Social Engineering*. Mengekstrak nomor tiket dan mencocokkan asal pengirim WA. Jika beda WA, bot tidak membocorkan data nopol dan mengirimkan sinyal peringatan ke pemilik aslinya.

## Core Lessons & Design Decisions
1. **Model Hallucination Control**: LLM ukuran kecil (seperti Qwen 3B) sangat rawan melanggar aturan JSON Array dan mengarang kata baru (contoh: ngarang intent `"jam_operasional"`). Prompt harus dikosakata keras *(Hard-constrained)*: "DILARANG KERAS MEMBUAT KATEGORI BARU".
2. **Basic LLM Chain vs Agent**: Dalam n8n The New Version, `Model Node` tidak berdiri sendiri, wajib diikat ke *Chain* untuk merespon secara natural. Opsi `Basic LLM Chain` sangat jauh lebih stabil dibanding `ReAct Agent`.
3. **Multi-turn Memory (`sesi_chat`)**: Jangan asumsikan user memberi pesan utuh 100%. User sering putus-putus. Gunakan *State Machine* MySQL untuk mengingat konteks. Kalo Nopol/Motor udh ada, jangan ditanya dua kali.
4. **Database Single Point of Truth**: Tabel `booking` dan `pelanggan` ada dalam 1 Database terpusat meskipun melayani 5 cabang berbeda. Pemisahannya cukup mengandalkan Filter pada saat View `SELECT * FROM ... WHERE cabang_id='xxx'`.
5. **Frontend Next Step**: Pembangunan GUI untuk scan 4 QR Code dari API GoWA dan klik tombol status `selesai` (menembak Update MySQL).

## Work Status (Last Updated 2026-04-13)
- Flow 01, 02, 03, dan 05 100% SUKSES TERSAMBUNG dan LOLOS UJI LOGIKA.
- LLM System Prompt sudah diperketat layaknya perwira militer (Anti Halusinasi Output). 
- FRONTEND KANBAN DASHBOARD SELESAI & OPERASIONAL DENGAN ARSITEKTUR MULTI-TENANT ISOLASI PORT MUTLAK (Port Mapping Frontend `window.location.port`).
- BUG DATABASE & BACKEND (Stale process, salah nama tabel, order urutan UI Kanban, status nyangkut) telah diperbaiki dan dibersihkan otomatis pada `START_ECOSYSTEM.bat`.
- Sistem berada pada kondisi STABIL dan SIAP PAKAI secara penuh untuk operasional harian.
