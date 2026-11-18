/**
 * Danh mục các dịch vụ có thể kết nối.
 *
 * Mỗi kết nối khi làm thật sẽ gồm:
 *   - Luồng xác thực (OAuth2 → route /api/integrations/<key>/callback, hoặc API key / bot token)
 *   - Lưu token đã mã hóa vào bảng `integrations` (xem lib/crypto.ts)
 *   - Job đồng bộ / webhook để kéo dữ liệu về thành `items`
 *   - Các "tool" để Trợ lý AI có thể đọc/ghi dữ liệu của dịch vụ đó
 */
export type IntegrationDef = {
  key: string;
  name: string;
  description: string;
  auth: "oauth2" | "api_key" | "bot_token";
  /** Biến môi trường cần có trước khi kết nối được */
  envVars: string[];
  status: "planned" | "available";
};

export const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    description: "Xem lịch, tạo sự kiện từ công việc, AI gợi ý sắp xếp thời gian.",
    auth: "oauth2",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    status: "planned",
  },
  {
    key: "gmail",
    name: "Gmail",
    description: "Biến email thành công việc, AI tóm tắt và soạn thư trả lời.",
    auth: "oauth2",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    status: "planned",
  },
  {
    key: "google_drive",
    name: "Google Drive / Docs / Sheets",
    description: "Đính kèm và tìm kiếm tài liệu, AI đọc nội dung file.",
    auth: "oauth2",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    status: "planned",
  },
  {
    key: "youtube",
    name: "YouTube",
    description: "Theo dõi số liệu kênh, video, bình luận; AI phân tích hiệu quả nội dung.",
    auth: "oauth2",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    status: "planned",
  },
  {
    key: "notion",
    name: "Notion",
    description: "Đồng bộ trang và database Notion về WorkHub.",
    auth: "oauth2",
    envVars: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
    status: "planned",
  },
  {
    key: "telegram",
    name: "Telegram Bot",
    description: "Nhắn bot để thêm việc nhanh, nhận nhắc việc và báo cáo AI hằng ngày.",
    auth: "bot_token",
    envVars: ["TELEGRAM_BOT_TOKEN"],
    status: "planned",
  },
  {
    key: "github",
    name: "GitHub",
    description: "Theo dõi issue, pull request liên quan đến công việc.",
    auth: "oauth2",
    envVars: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    status: "planned",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Nhận thông báo, tạo việc từ tin nhắn.",
    auth: "oauth2",
    envVars: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    status: "planned",
  },
];

export function missingEnv(def: IntegrationDef): string[] {
  return def.envVars.filter((v) => !process.env[v]);
}
