#!/bin/bash
# ============================================================
# Sapa-Tazkia — MySQL Automated Backup Script
# Usage: ./scripts/backup.sh
# Cron: 0 2 * * * /path/to/sapa-tazkia/backend/scripts/backup.sh
# ============================================================

set -euo pipefail

# ---- Configuration ----
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sapa-tazkia}"
DB_NAME="${MYSQL_DATABASE:-sapa_tazkia}"
DB_USER="${MYSQL_USER:-root}"
DB_PASS="${MYSQL_ROOT_PASSWORD}"
DB_HOST="${MYSQL_HOST:-127.0.0.1}"
DB_PORT="${MYSQL_PORT:-3306}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ---- Ensure backup dir exists ----
mkdir -p "${BACKUP_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "============================================"
log "Starting backup: ${DB_NAME} → ${BACKUP_FILE}"

# ---- Dump & Compress ----
if mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --single-transaction \
  --routines \
  --triggers \
  --add-drop-table \
  "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"; then

  SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
  log "✅ Backup successful: ${BACKUP_FILE} (${SIZE})"
else
  log "❌ Backup FAILED for database: ${DB_NAME}"
  exit 1
fi

# ---- Retention: Delete backups older than RETENTION_DAYS ----
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.sql.gz" \
  -mtime +${RETENTION_DAYS} -delete -print | wc -l)
log "🗑  Deleted ${DELETED} old backup(s)"

# ---- Summary ----
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
log "📦 Total backups: ${TOTAL_BACKUPS}, Directory size: ${TOTAL_SIZE}"
log "Backup complete."
