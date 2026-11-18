import { defineConfig } from "drizzle-kit";

// Chỉ dùng để sinh migration SQL từ schema: `npm run db:generate`.
// Migration được app tự chạy khi khởi động (xem src/lib/db/index.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
