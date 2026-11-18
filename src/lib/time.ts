/**
 * Tiện ích ngày giờ theo GIỜ ĐỊA PHƯƠNG của server.
 * Khi chạy trên VPS, đặt biến môi trường TZ=Asia/Ho_Chi_Minh để đúng giờ Việt Nam.
 */
const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

const pad = (n: number) => String(n).padStart(2, "0");

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/** "2026-11-19" theo giờ địa phương */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Thứ 2 đầu tuần chứa ngày d */
export function startOfWeek(d: Date): Date {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  return startOfDay(addDays(d, 1 - day));
}

/**
 * Đọc "YYYY-MM-DD" hoặc "YYYY-MM-DDTHH:mm" thành Date theo giờ địa phương.
 * Trả null nếu không hợp lệ.
 */
export function parseLocalDateTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), h ? Number(h) : 0, mi ? Number(mi) : 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Có giờ cụ thể (khác 00:00) hay chỉ có ngày */
export function hasTime(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** "YYYY-MM-DD" hoặc "YYYY-MM-DDTHH:mm" để gửi cho AI */
export function toLocalIso(d: Date): string {
  return hasTime(d) ? `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` : dateKey(d);
}

/**
 * Đoạn mô tả "hôm nay" cho AI, kèm bảng 7 ngày tới để AI quy đổi
 * "mai", "thứ 6", "tuần sau" thành ngày chính xác.
 */
export function dateContextForAI(now = new Date()): string {
  const next = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(now, i);
    return `${weekdayName(d)} ${dateKey(d)}${i === 0 ? " (hôm nay)" : i === 1 ? " (ngày mai)" : ""}`;
  });
  return `Bây giờ là ${weekdayName(now)}, ${dateKey(now)} lúc ${pad(now.getHours())}:${pad(now.getMinutes())} (giờ địa phương).
Các ngày sắp tới: ${next.join("; ")}.`;
}
