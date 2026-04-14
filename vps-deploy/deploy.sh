#!/bin/bash
# ============================================================
# FITMOTOR CRM — Deploy Script (Jalankan di VPS setelah git pull)
# Usage: bash deploy.sh
# ============================================================

set -e
echo "=============================================="
echo " FITMOTOR VPS DEPLOY"
echo "=============================================="

REPO_DIR="$(pwd)"

# ── STEP 1: Pull latest code ──────────────────────────────────
echo ""
echo "[1/5] Pulling latest code from GitHub..."
git pull origin main
echo "      OK"

# ── STEP 2: Install backend deps ─────────────────────────────
echo ""
echo "[2/5] Installing backend dependencies..."
cd "$REPO_DIR/api"
npm install --omit=dev
cd "$REPO_DIR"
echo "      OK"

# ── STEP 3: Build frontend ────────────────────────────────────
echo ""
echo "[3/5] Building frontend (TypeScript → dist/)..."
cd "$REPO_DIR/frontend"
npm install
npm run build
cd "$REPO_DIR"
echo "      OK: dist/ sudah diperbarui"

# ── STEP 4: Run database migration ───────────────────────────
echo ""
echo "[4/5] Running Migration V3..."
DB_USER="dongkrak_user"
DB_PASS='Uangmengalirderaskerekeningku8*()'
DB_NAME="fitmotor_crm"

mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$REPO_DIR/database/migration_v3.sql"
echo "      OK: Migration V3 selesai"

# ── STEP 5: Restart PM2 ───────────────────────────────────────
echo ""
echo "[5/5] Restarting PM2 processes..."
pm2 restart all
sleep 2
pm2 list

echo ""
echo "=============================================="
echo " DEPLOY SELESAI!"
echo "  Master   : http://103.174.114.249:5000"
echo "  Adiwerna : http://103.174.114.249:5001"
echo "  Pesalakan: http://103.174.114.249:5002"
echo "  Pacul    : http://103.174.114.249:5003"
echo "  Cikditiro: http://103.174.114.249:5004"
echo ""
echo "  API Health: curl http://103.174.114.249:3002/health"
echo "=============================================="
