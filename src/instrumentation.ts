/**
 * Chạy một lần khi server khởi động: bật bộ hẹn giờ tự tạo Bản tin sáng / Tổng kết tuần.
 * Tắt bằng BRIEF_AUTO=off. Giờ tạo: BRIEF_HOUR (mặc định 7), ngày tổng kết: WEEKLY_REVIEW_DAY (mặc định 1 = thứ 2).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.BRIEF_AUTO === "off") return;

  const g = globalThis as { __workhubScheduler?: boolean };
  if (g.__workhubScheduler) return;
  g.__workhubScheduler = true;

  const tick = async () => {
    try {
      const { runScheduledBriefs } = await import("./lib/brief");
      const { created } = await runScheduledBriefs();
      if (created.length) console.log(`[brief] Đã tự tạo ${created.length} bản tin`);
    } catch (err) {
      console.error("[brief] Lỗi bộ hẹn giờ:", err);
    }
  };

  setTimeout(tick, 30_000).unref?.();
  setInterval(tick, 10 * 60_000).unref?.();
}
