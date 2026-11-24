#!/usr/bin/env bash
# Khôi phục database từ một file sao lưu. GHI ĐÈ toàn bộ dữ liệu hiện tại.
# Cách dùng:  ./scripts/restore.sh backups/workhub-YYYYMMDD-HHMM.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?Cách dùng: ./scripts/restore.sh backups/workhub-YYYYMMDD-HHMM.sql.gz}"
[ -f "$FILE" ] || { echo "Không tìm thấy file $FILE" >&2; exit 1; }

echo "Thao tác này sẽ XÓA dữ liệu hiện tại và thay bằng nội dung trong $FILE."
read -r -p "Gõ 'dong y' để tiếp tục: " answer
[ "$answer" = "dong y" ] || { echo "Đã hủy."; exit 1; }

# Sao lưu dữ liệu hiện tại trước khi ghi đè, phòng khi chọn nhầm file
./scripts/backup.sh

docker compose stop app
gunzip -c "$FILE" | docker compose exec -T db psql -U workhub -d workhub -v ON_ERROR_STOP=1 --quiet
docker compose start app
echo "Đã khôi phục từ $FILE"
