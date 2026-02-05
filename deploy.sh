#!/bin/bash

# ==========================================
# SAPA-TAZKIA DEPLOYMENT SCRIPT
# Server: sapa.tazkia.ac.id (103.150.226.185)
# ==========================================

set -e  # Exit on error

echo "========================================"
echo "  SAPA-TAZKIA DEPLOYMENT SCRIPT"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/sapa-tazkia"
BACKUP_DIR="/var/backups/sapa-tazkia"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ==========================================
# STEP 1: Pre-deployment checks
# ==========================================
echo -e "${YELLOW}[1/7] Running pre-deployment checks...${NC}"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run with sudo${NC}"
    exit 1
fi

# Check required services
for service in nginx mysql redis-server; do
    if ! systemctl is-active --quiet $service 2>/dev/null; then
        echo -e "${YELLOW}Warning: $service is not running${NC}"
    fi
done

echo -e "${GREEN}Pre-deployment checks passed!${NC}"

# ==========================================
# STEP 2: Backup existing deployment
# ==========================================
echo -e "${YELLOW}[2/7] Creating backup...${NC}"

mkdir -p $BACKUP_DIR
if [ -d "$APP_DIR" ]; then
    tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C $APP_DIR . 2>/dev/null || true
    echo -e "${GREEN}Backup created: backup_$TIMESTAMP.tar.gz${NC}"
fi

# ==========================================
# STEP 3: Pull latest code (if using git)
# ==========================================
echo -e "${YELLOW}[3/7] Pulling latest code...${NC}"

if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR
    git pull origin main
    echo -e "${GREEN}Code updated from git!${NC}"
else
    echo -e "${YELLOW}Skipping git pull (not a git repository)${NC}"
fi

# ==========================================
# STEP 4: Install dependencies
# ==========================================
echo -e "${YELLOW}[4/7] Installing dependencies...${NC}"

# Backend
cd $APP_DIR/backend
npm ci --production
npx prisma generate
npx prisma db push --accept-data-loss

# Frontend (if building on server)
# cd $APP_DIR/frontend
# npm ci
# npm run build

echo -e "${GREEN}Dependencies installed!${NC}"

# ==========================================
# STEP 5: Setup environment files
# ==========================================
echo -e "${YELLOW}[5/7] Setting up environment...${NC}"

# Copy production env if not exists
if [ ! -f "$APP_DIR/backend/.env" ]; then
    if [ -f "$APP_DIR/backend/.env.production" ]; then
        cp $APP_DIR/backend/.env.production $APP_DIR/backend/.env
        echo -e "${YELLOW}Copied .env.production to .env - PLEASE UPDATE VALUES!${NC}"
    fi
fi

echo -e "${GREEN}Environment configured!${NC}"

# ==========================================
# STEP 6: Start Docker services
# ==========================================
echo -e "${YELLOW}[6/7] Starting Docker services...${NC}"

cd $APP_DIR
docker-compose up -d

# Wait for services to be ready
sleep 5
echo -e "${GREEN}Docker services started!${NC}"

# ==========================================
# STEP 7: Restart application with PM2
# ==========================================
echo -e "${YELLOW}[7/7] Restarting application...${NC}"

cd $APP_DIR/backend

# Check if PM2 process exists
if pm2 describe sapa-tazkia > /dev/null 2>&1; then
    pm2 restart sapa-tazkia
else
    pm2 start src/app.js --name sapa-tazkia --env production
fi

pm2 save

echo -e "${GREEN}Application restarted!${NC}"

# ==========================================
# DEPLOYMENT COMPLETE
# ==========================================
echo ""
echo -e "${GREEN}========================================"
echo "  DEPLOYMENT COMPLETE!"
echo "========================================${NC}"
echo ""
echo "Application URL: https://sapa.tazkia.ac.id"
echo ""
echo "Useful commands:"
echo "  pm2 status           - Check app status"
echo "  pm2 logs sapa-tazkia - View logs"
echo "  pm2 restart sapa-tazkia - Restart app"
echo ""
echo -e "${YELLOW}Don't forget to:${NC}"
echo "  1. Update .env with real credentials"
echo "  2. Setup SSL with: sudo certbot --nginx -d sapa.tazkia.ac.id"
echo "  3. Update Google OAuth callback URL"
echo ""
