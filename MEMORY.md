# FIT MOTOR CRM - LONG TERM MEMORY 🧠

## Architecture Overview (Production Live)
Ini adalah ekosistem AI CRM Bengkel standar Enterprise yang sudah **LIVE** di VPS.
Integrasi: **n8n v1.x (Docker)** + **OpenRouter Cloud AI** + **MySQL** + **GoWA Multi-Device (Docker)**.

## Infrastructure Details (VPS Production)
- **Host IP:** `103.174.114.249` (User: `emlsl`)
- **Web App Dashboard:**
  - Master Dashboard: Port `5000`
  - Branch Dashboards: Port `5001` (Adiwerna), `5002` (Pesalakan), `5003` (Pacul), `5004` (Cikditiro).
- **API Backend:** Port `3002` (Node.js API Bridge).
- **WhatsApp Gateway:** Port `3010` (GoWA Docker).
- **Automation Engine:** Port `5678` (n8n Docker).
- **Database:** MySQL `fitmotor_crm` (User: `dongkrak_user`, Pass: `Uangmengalirderaskerekeningku8*()`).
- **AI Brain:** Diarahkan ke **OpenRouter** (Model: `google/gemma-4-31b-it:free`) untuk hemat sumber daya VPS. API Key tersimpan di `config/env.json`.

## Core Lessons & Design Decisions (Deployment Phase)
1. **VPS Multi-Tenant Isolation:** Gunakan Port-Based detection di frontend (`window.location.port`) untuk memisahkan cabang secara mutlak tanpa takut env variable tercampur.
2. **Dockerization for WA:** GoWA wajib di kontainer Docker agar isolasi session (multi-device) stabil. Port 3000 sering bentrok, dipindahkan ke **3010**.
3. **n8n Security Cookie:** Pada VPS tanpa SSL, n8n wajib diset `N8N_SECURE_COOKIE=false` agar bisa login via IP publik.
4. **Cloud AI vs Local AI:** Untuk VPS dengan RAM < 8GB, hindari Ollama lokal. OpenRouter API jauh lebih stabil dan responsif untuk production.
5. **AI Reasoning Handling (CoT Bug):** Model seperti Gemma 4 / Gemini 2.0 sering menyertakan "pikiran" di dalam tag `<thought>`. 
   - **Problem:** Regex `{...}` yang greedy sering menangkap snippet di dalam tag thought, membuat JSON rusak.
   - **Solution:** Wajib hapus tag `<thought>[\s\S]*?<\/thought>` (Case-Insensitive) sebelum parsing JSON di n8n.

## Work Status (Full Live Test 2026-04-13)
- [x] Migrasi Code ke Repo Github `asubasah/tunapedes`.
- [x] Deployment API & Frontend via PM2 Sukses.
- [x] Database Deployment & Schema Import Sukses.
- [x] GoWA Docker Up & Running di Port 3010.
- [x] n8n Docker Up & Running di Port 5678.
- [x] API_BASE Fix (Dynamic IP detection untuk Dashboard).
- [x] AI Brain Migration (Ollama -> OpenRouter) SUCCESS.
- [x] Robust AI Parser Implementation (Anti-Thought Block).

Sistem sekarang dalam kondisi **"READY FOR CLIENT"**.
