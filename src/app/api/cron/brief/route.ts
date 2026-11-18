import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runScheduledBriefs } from "@/lib/brief";

/**
 * Điểm gọi từ bộ lập lịch bên ngoài (Vercel Cron, cron của server...) khi app
 * không chạy liên tục. Cần đặt CRON_SECRET và gửi header: Authorization: Bearer <CRON_SECRET>.
 * Khi chạy liên tục (máy cá nhân, VPS) không cần: src/instrumentation.ts tự gọi.
 */
export async function GET(request: Request) {
  // Luôn chạy lúc có request thật, không prerender lúc build
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET chưa được đặt" }, { status: 404 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Không có quyền" }, { status: 401 });
  }

  return Response.json(await runScheduledBriefs());
}
