#!/bin/bash
# ==============================================================================
# SCRIPT DEPLOYMENT & UPDATE 1-KLIK SERVER LINUX (WLAN / PRODUCTION)
# Berikan hak akses eksekusi: chmod +x deploy.sh
# Jalankan: ./deploy.sh
# ==============================================================================

set -e

echo "🚀 [1/5] Mengambil pembaruan source code terbaru..."
if [ -d .git ]; then
  git pull origin main || git pull
else
  echo "ℹ️  Bukan repositori git, melewati langkah git pull."
fi

echo "📦 [2/5] Memasang dependensi Node.js..."
npm install --prefer-offline --no-audit

echo "🗄️  [3/5] Menyiapkan struktur tabel database & data awal..."
npm run db:setup

echo "⚡ [4/5] Membangun aplikasi Next.js (Production Build)..."
npm run build

echo "🔄 [5/5] Memulai ulang proses PM2..."
if command -v pm2 &> /dev/null; then
  pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
  echo ""
  echo "📊 Status Proses PM2:"
  pm2 status
else
  echo "⚠️  PM2 belum terpasang secara global. Pasang dengan: sudo npm install -g pm2"
fi

echo ""
echo "✅ ================================================================="
echo "✅ DEPLOYMENT SELESAI & BERHASIL!"
echo "✅ Buka browser di perangkat Anda (di jaringan WiFi yang sama):"
echo "✅ http://<IP_SERVER_LINUX> atau http://<IP_SERVER_LINUX>:3000"
echo "✅ ================================================================="
