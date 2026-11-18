# WorkHub

Web app all-in-one để quản lý mọi công việc cá nhân, có AI (OpenAI, Gemini) hỗ trợ đánh giá và xử lý việc ngay trong app.

## Chạy trên máy

Cần Node.js 22 trở lên.

```bash
npm install
cp .env.example .env.local   # rồi điền APP_SECRET và API key
npm run dev
```

Mở http://localhost:3000. Lần đầu app sẽ hiện trang **Thiết lập** để tạo tài khoản chủ sở hữu.

Khi chạy trên máy, dữ liệu nằm trong thư mục `.data/pglite`. Đây là Postgres nhúng nên không cần cài database. Muốn sao lưu thì copy thư mục này.

## Đã có gì

| Phần | Mô tả |
|---|---|
| Đăng nhập | Một tài khoản chủ sở hữu, phiên lưu trong cookie httpOnly, mật khẩu băm bằng scrypt |
| Workspace | Mọi dữ liệu thuộc một workspace, sẵn sàng thêm thành viên khi mở rộng cho nhóm |
| Item chung | Task, ghi chú và các module sau này dùng chung bảng `items` (có tag, liên kết, nhật ký hoạt động) |
| Module mẫu | Tổng quan, Công việc, Ghi chú |
| Nhập nhanh (Ctrl+K) | Gõ một câu tự do, AI tách thành công việc hoặc ghi chú kèm hạn chót, ưu tiên và tag. Ô này cũng dùng để chuyển trang (tìm không dấu) và hỏi trợ lý. Xem `src/lib/capture.ts` |
| Trợ lý AI có công cụ | Trợ lý đọc và ghi được dữ liệu: liệt kê việc theo nhóm, tìm kiếm, đọc chi tiết, tạo việc hoặc ghi chú, sửa việc. Không có quyền xóa. Thêm công cụ trong `src/lib/agent-tools.ts` |
| Bản tin | Bản tin sáng và tổng kết tuần do AI viết từ dữ liệu thật. App tự tạo lúc `BRIEF_HOUR` giờ (mặc định 7h) và vào ngày `WEEKLY_REVIEW_DAY` (mặc định thứ 2) khi đang chạy. Xem `src/lib/brief.ts` |
| AI | Chat có lưu lịch sử; nút AI trên từng mục (Đánh giá, Tóm tắt, Chia nhỏ việc, Viết lại); chọn hãng và model ngay trên giao diện; ghi nhật ký token và thời gian của mọi lần gọi |
| Kết nối | Danh mục dịch vụ (Google, Notion, Telegram...) và bảng lưu token đã mã hóa, chưa có luồng kết nối thật |

## Cấu trúc

```
src/
  app/
    (auth)/            đăng nhập, thiết lập lần đầu
    (app)/             các trang sau khi đăng nhập (mỗi module một thư mục)
      actions.ts       server actions: tạo/sửa item
      items/[id]/      trang chi tiết dùng chung cho mọi loại item
    api/ai/            endpoint stream AI (chat, item-action, models)
  lib/
    db/schema.ts       toàn bộ schema database
    db/index.ts        kết nối DB (PGlite hoặc Postgres) và tự chạy migration
    auth/              phiên đăng nhập, mật khẩu, getCurrentUser/requireUser
    ai/                lớp AI: providers/ (openai, gemini), prompts.ts, streamAI/generateAI
    items.ts           truy cập dữ liệu item
    modules.ts         danh sách module trên thanh bên
    integrations.ts    danh mục dịch vụ kết nối
    crypto.ts          mã hóa token bằng APP_SECRET
drizzle/               file migration SQL
```

## Thêm một module mới

1. Thêm mục vào `MODULES` trong `src/lib/modules.ts`.
2. Tạo trang `src/app/(app)/<ten-module>/page.tsx`. Có thể chép từ `tasks/` hoặc `notes/`.
3. Lưu dữ liệu bằng `createItem({ type: "<ten-module>", data: {...} })`. Trường riêng của module đặt trong `data`.
4. Nếu cần bảng riêng: sửa `src/lib/db/schema.ts`, chạy `npm run db:generate`. Migration sẽ tự chạy khi app khởi động.

Muốn thêm nút AI mới cho item thì thêm một mục vào `ITEM_ACTIONS` trong `src/lib/ai/prompts.ts`. Muốn thêm hãng AI mới thì tạo file trong `src/lib/ai/providers/` và đăng ký trong `src/lib/ai/index.ts`.

## Đưa lên mạng (hosting)

"Host" là cho app chạy 24/7 trên một máy chủ, để bạn mở được từ điện thoại hay máy khác ở bất cứ đâu.

| Cách | Chi phí | Hợp khi |
|---|---|---|
| **VPS + Docker** (khuyên dùng) | khoảng 5–10 USD/tháng | Muốn toàn quyền dữ liệu, chạy job nền và đồng bộ liên tục |
| Vercel + Neon/Supabase | Có gói miễn phí | Muốn nhanh, không quản trị server (bị giới hạn thời gian chạy mỗi request) |
| Chạy trên máy mình | 0 | Chỉ dùng khi máy đang bật, khó truy cập từ xa |

Chạy trên VPS bằng Docker:

```bash
cp .env.example .env    # điền APP_SECRET, POSTGRES_PASSWORD, API key
docker compose up -d --build
```

Sau đó trỏ tên miền về VPS và đặt HTTPS phía trước, ví dụ bằng Caddy hoặc Coolify.

## Lệnh hay dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy chế độ phát triển |
| `npm run build && npm start` | Build và chạy bản production |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run db:generate` | Sinh migration sau khi sửa schema |
| `npm run db:studio` | Mở giao diện xem dữ liệu (chỉ dùng với Postgres thật qua `DATABASE_URL`) |
