import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return dateFmt.format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  return dateTimeFmt.format(new Date(d));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

const dueTimeFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Hạn chót: chỉ ngày, hoặc ngày + giờ nếu có giờ cụ thể */
export function formatDue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.getHours() || date.getMinutes() ? dueTimeFmt.format(date) : formatDate(date);
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
