# Đưa WorkHub lên VPS

Hướng dẫn cho VPS chạy **Ubuntu 22.04 hoặc 24.04**, tối thiểu **2GB RAM** (khuyên dùng 4GB). Mất khoảng 20–30 phút.

Kết quả: WorkHub chạy ở `https://tên-miền-của-bạn`, có HTTPS tự động, database PostgreSQL, sao lưu mỗi đêm.

```
Internet ──► Caddy (80/443, HTTPS tự động) ──► app (Next.js) ──► db (PostgreSQL)
```

---

## 1. Chuẩn bị

- **IP và mật khẩu root** của VPS (nhà cung cấp gửi qua email).
- **Tên miền** trỏ về VPS: vào trang quản lý tên miền, tạo bản ghi `A` trỏ về IP của VPS.
  Chưa có tên miền thì dùng tạm `sslip.io`. Ví dụ IP là `203.0.113.5` thì tên miền là `203-0-113-5.sslip.io`, không cần cấu hình gì.
- Code đã được **gộp vào nhánh `main`** trên GitHub.

## 2. Đăng nhập VPS và bật tường lửa

Trên máy bạn:

```bash
ssh root@IP_CUA_VPS
```

Trên VPS:

```bash
apt update && apt upgrade -y
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
```

## 3. Cài Docker

Dùng script cài đặt chính thức của Docker:

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

Nếu VPS chỉ có 2GB RAM, tạo thêm 2GB swap để bước build không bị thiếu bộ nhớ:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 4. Lấy code

```bash
cd /opt
git clone https://github.com/HoanTiny/Tiny-Assistant.git workhub
cd workhub
```

Nếu repo để **riêng tư (private)**, GitHub sẽ hỏi mật khẩu. Khi đó dùng *Personal access token* thay mật khẩu: vào GitHub → Settings → Developer settings → Fine-grained tokens, tạo token chỉ có quyền đọc repo này.

## 5. Tạo file cấu hình `.env`

```bash
cp .env.example .env
openssl rand -base64 32   # chạy 3 lần, lấy 3 chuỗi khác nhau cho 3 biến bên dưới
nano .env
```

Điền ít nhất các dòng sau (lưu bằng `Ctrl+O`, Enter, thoát bằng `Ctrl+X`):

| Biến | Giá trị |
|---|---|
| `APP_SECRET` | chuỗi ngẫu nhiên thứ nhất |
| `SETUP_TOKEN` | chuỗi ngẫu nhiên thứ hai (dùng một lần ở bước 7) |
| `POSTGRES_PASSWORD` | chuỗi ngẫu nhiên thứ ba |
| `DOMAIN` | tên miền ở bước 1, ví dụ `workhub.tenmien.vn` |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | key của bạn |
| `TZ` | giữ `Asia/Ho_Chi_Minh` |

Để trống `DATABASE_URL`: docker compose tự điền.

> **Giữ bí mật file `.env`.** Không gửi file này cho ai, không đưa lên GitHub (đã có trong `.gitignore`).
> Đổi `APP_SECRET` sau này sẽ làm mất các kết nối dịch vụ đã lưu.

## 6. Chạy

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app   # xem log, thoát bằng Ctrl+C
```

Lần đầu build mất vài phút. Caddy tự xin chứng chỉ HTTPS trong khoảng 1 phút sau khi chạy.

## 7. Tạo tài khoản

Mở `https://tên-miền-của-bạn/setup`, nhập **mã thiết lập** (`SETUP_TOKEN` ở bước 5), tên, email, mật khẩu.

Sau khi tạo xong, trang `/setup` tự khóa vĩnh viễn. Bạn có thể xóa giá trị `SETUP_TOKEN` trong `.env`.

## 8. Sao lưu tự động mỗi đêm

```bash
chmod +x scripts/*.sh
./scripts/backup.sh          # thử sao lưu một lần
crontab -e                   # chọn nano nếu được hỏi
```

Thêm dòng này vào cuối file (sao lưu lúc 2 giờ sáng, giữ 14 ngày):

```
0 2 * * * cd /opt/workhub && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Bản sao lưu nằm trong `/opt/workhub/backups`. **Nên chép định kỳ ra ngoài VPS** (máy bạn, Google Drive): nếu VPS hỏng thì bản sao lưu trên VPS cũng mất. Từ máy bạn:

```bash
scp root@IP_CUA_VPS:/opt/workhub/backups/*.sql.gz .
```

Khôi phục (ghi đè dữ liệu hiện tại; script tự sao lưu bản hiện tại trước):

```bash
./scripts/restore.sh backups/workhub-YYYYMMDD-HHMM.sql.gz
```

## 9. Cập nhật phiên bản mới

```bash
cd /opt/workhub
./scripts/backup.sh
git pull
docker compose up -d --build
```

Thay đổi database (migration) được chạy tự động khi app khởi động.

---

## Khi gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Không vào được trang, trình duyệt báo lỗi chứng chỉ | Kiểm tra bản ghi `A` đã trỏ đúng IP (`ping tên-miền`), cổng 80 và 443 đã mở (bước 2). Xem `docker compose logs caddy`. |
| Build bị dừng giữa chừng, log có `Killed` | Thiếu RAM: tạo swap ở bước 3 rồi chạy lại. |
| Đăng nhập xong vẫn bị đẩy về trang đăng nhập | Phải truy cập qua `https://`. Cookie đăng nhập chỉ gửi qua HTTPS. |
| Báo "Đăng nhập sai quá nhiều lần" | Đợi 15 phút, hoặc khởi động lại app: `docker compose restart app`. |
| Bản tin không tự tạo lúc 7h | Kiểm tra đã có API key, và `TZ` đúng. Xem `docker compose logs app \| grep brief`. |

## Bảo mật đã có sẵn

- Chỉ Caddy mở cổng ra internet; app và database chỉ nói chuyện trong mạng nội bộ của Docker.
- HTTPS tự động, có HSTS.
- Trang `/setup` cần mã thiết lập; trên server thật, không đặt mã thì trang bị khóa.
- Khóa đăng nhập 15 phút sau 5 lần sai (theo IP và theo email). Bộ đếm reset khi app khởi động lại.
- Mật khẩu băm bằng scrypt; phiên đăng nhập lưu dạng băm trong database; cookie `httpOnly` và `secure`.
- Header chống nhúng trang (clickjacking) và chống đoán kiểu nội dung.
