@echo off
echo ==============================================
echo  STARTING FITMOTOR ENTERPRISE (MULTI-TENANT)
echo ==============================================

echo [0/3] Cleaning up stale processes...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM windows-amd64.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/3] Starting GoWA Engine...
start cmd /k "title GoWA && cd d:\Janciq\workspace\gowa && windows-amd64.exe rest --webhook=""http://localhost:3002/webhook/gowa"""

echo [2/3] Starting Backend API Bridge...
start cmd /k "title API_Bridge && cd d:\fitmorot\api && node server.js"

timeout /t 3 /nobreak >nul

echo [3/3] Starting 5 Vite Instances (using --mode per cabang)...

rem Master (Port 5000)
start cmd /k "title MASTER_5000 && cd d:\fitmorot\frontend && npm run dev -- --port 5000 --mode master --open"

rem Adiwerna (Port 5001)
start cmd /k "title ADIWERNA_5001 && cd d:\fitmorot\frontend && npm run dev -- --port 5001 --mode adiwerna"

rem Pesalakan (Port 5002)
start cmd /k "title PESALAKAN_5002 && cd d:\fitmorot\frontend && npm run dev -- --port 5002 --mode pesalakan"

rem Pacul (Port 5003)
start cmd /k "title PACUL_5003 && cd d:\fitmorot\frontend && npm run dev -- --port 5003 --mode pacul"

rem Cikditiro (Port 5004)
start cmd /k "title CIKDITIRO_5004 && cd d:\fitmorot\frontend && npm run dev -- --port 5004 --mode cikditiro"

echo.
echo ============================================
echo  All services launched!
echo ============================================
echo  Master   : http://localhost:5000  (fitmotor / testing08)
echo  Adiwerna : http://localhost:5001  (adiwerna / testing08)
echo  Pesalakan: http://localhost:5002  (pesalakan / testing08)
echo  Pacul    : http://localhost:5003  (pacul / testing08)
echo  Cikditiro: http://localhost:5004  (cikditiro / testing08)
echo ============================================
