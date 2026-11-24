#!/usr/bin/env bash
# Sao lưu database WorkHub thành file .sql.gz trong thư mục backups/.
# Chạy trên VPS, trong thư mục dự án:  ./scripts/backup.sh
# Tự xóa bản cũ hơn KEEP_DAYS ngày (mặc định 14).
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p backups
FILE="backups/workhub-$(date +%Y%m%d-%H%M).sql.gz"

docker compose exec -T db pg_dump -U workhub --no-owner --clean --if-exists workhub | gzip > "$FILE"

if [ ! -s "$FILE" ]; then
  echo "Sao lưu thất bại: file rỗng" >&2
  rm -f "$FILE"
  exit 1
fi

find backups -name 'workhub-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Đã sao lưu: $FILE ($(du -h "$FILE" | cut -f1))"
